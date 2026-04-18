import { useState, useRef } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  LayoutAnimation,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  UIManager,
  View,
} from 'react-native';
import { useGroceryItems, GroceryItem } from '../lib/useGroceryItems';
import { supabase } from '../lib/supabase';
import { useCorrectCategory } from '../hooks/useCorrectCategory';

if (
  Platform.OS === 'android' &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const CATEGORIES = [
  'ניקיון',
  'היגיינה',
  'מוצרים למטבח',
  'אפייה',
  'חטיפים',
  'מוצרים יבשים ושימורים',
  'שתייה',
  'מוצרי חלב וביצים',
  'בשר עוף ודגים',
  'לחם',
  'מוצרים לבית',
  'אוכל מוכן',
  'ירקות ופירות',
] as const;

const FALLBACK_CATEGORY = 'מוצרים יבשים ושימורים';

interface SuggestItem {
  name: string;
  category: string;
}

interface GroupedItems {
  category: string;
  unchecked: GroceryItem[];
  checked: GroceryItem[];
}

function groupByCategory(items: GroceryItem[]): GroupedItems[] {
  const map = new Map<
    string,
    { unchecked: GroceryItem[]; checked: GroceryItem[] }
  >();
  for (const item of items) {
    const entry = map.get(item.category) || { unchecked: [], checked: [] };
    if (item.checked) {
      entry.checked.push(item);
    } else {
      entry.unchecked.push(item);
    }
    map.set(item.category, entry);
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => {
      const ia = CATEGORIES.indexOf(a as (typeof CATEGORIES)[number]);
      const ib = CATEGORIES.indexOf(b as (typeof CATEGORIES)[number]);
      return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
    })
    .map(([category, { unchecked, checked }]) => ({
      category,
      unchecked,
      checked: checked.sort((a, b) =>
        a.item_name.localeCompare(b.item_name, 'he'),
      ),
    }));
}

function ItemRow({
  item,
  onToggleCheck,
  onEditCategory,
  onDelete,
  isEditing,
  editText,
  onStartEdit,
  onEditTextChange,
  onEditSubmit,
}: {
  item: GroceryItem;
  onToggleCheck: (item: GroceryItem) => void;
  onEditCategory: (item: GroceryItem) => void;
  onDelete: (item: GroceryItem) => void;
  isEditing: boolean;
  editText: string;
  onStartEdit: (item: GroceryItem) => void;
  onEditTextChange: (text: string) => void;
  onEditSubmit: () => void;
}) {
  return (
    <View style={styles.itemRow}>
      <TouchableOpacity
        style={styles.deleteButton}
        onPress={() => onDelete(item)}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Text style={styles.deleteIcon}>✕</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.checkButton}
        onPress={() => onToggleCheck(item)}
      >
        <Text style={styles.checkIcon}>○</Text>
      </TouchableOpacity>

      {isEditing ? (
        <TextInput
          style={styles.itemNameInput}
          value={editText}
          onChangeText={onEditTextChange}
          onSubmitEditing={onEditSubmit}
          onBlur={onEditSubmit}
          autoFocus
          selectTextOnFocus
          textAlign="right"
          returnKeyType="done"
        />
      ) : (
        <TouchableOpacity
          style={styles.itemNameButton}
          onPress={() => onStartEdit(item)}
        >
          <Text style={styles.itemName}>{item.item_name}</Text>
        </TouchableOpacity>
      )}

      <TouchableOpacity
        style={styles.categoryBadge}
        onPress={() => onEditCategory(item)}
      >
        <Text style={styles.categoryBadgeText}>{item.category}</Text>
      </TouchableOpacity>
    </View>
  );
}

function CheckedItemRow({
  item,
  onUncheck,
  onDelete,
}: {
  item: GroceryItem;
  onUncheck: (item: GroceryItem) => void;
  onDelete: (item: GroceryItem) => void;
}) {
  return (
    <View style={styles.checkedItemRow}>
      <TouchableOpacity onPress={() => onUncheck(item)} style={styles.checkedRowMain}>
        <View style={styles.checkedCircle}>
          <Text style={styles.checkedIcon}>✓</Text>
        </View>
        <Text style={styles.checkedItemName}>{item.item_name}</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.deleteButton}
        onPress={() => onDelete(item)}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Text style={styles.deleteIcon}>✕</Text>
      </TouchableOpacity>
    </View>
  );
}

export default function GroceryListScreen() {
  const { items, loading, error, optimisticInsert, optimisticDelete, optimisticUpdate } = useGroceryItems();
  const { correctCategory } = useCorrectCategory();
  const [editingItem, setEditingItem] = useState<GroceryItem | null>(null);
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const [expandedChecked, setExpandedChecked] = useState<Set<string>>(
    new Set(),
  );
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const editingRef = useRef<string | null>(null);

  // Autocomplete state
  const [suggestions, setSuggestions] = useState<SuggestItem[]>([]);
  const [suggestedCategory, setSuggestedCategory] = useState<string | null>(null);
  const suggestTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [inputBarBottom, setInputBarBottom] = useState(0);

  const onInputChange = (text: string) => {
    setInputText(text);
    setSuggestedCategory(null);

    if (suggestTimer.current) clearTimeout(suggestTimer.current);

    setSuggestions([]); // clear immediately so stale results never show

    if (text.trim().length >= 1) {
      const querySnapshot = text.trim(); // capture value at schedule time
      suggestTimer.current = setTimeout(async () => {
        try {
          const apiUrl = `${process.env.EXPO_PUBLIC_API_BASE_URL}/suggest?q=${encodeURIComponent(querySnapshot)}`;
          const res = await fetch(apiUrl);
          if (!res.ok) return;
          const data: SuggestItem[] = await res.json();
          setSuggestions(data);
        } catch {
          // Suggestions are best-effort; never block the user
        }
      }, 300);
    }
  };

  const onSuggestionTap = (s: SuggestItem) => {
    setInputText(s.name);
    setSuggestedCategory(s.category);
    setSuggestions([]);
  };

  const toggleExpandedChecked = (category: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedChecked((prev) => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  };

  const startEditing = (item: GroceryItem) => {
    editingRef.current = item.id;
    setEditingItemId(item.id);
    setEditText(item.item_name);
  };

  const saveEdit = async () => {
    const itemId = editingRef.current;
    if (!itemId) return;
    editingRef.current = null;
    setEditingItemId(null);

    const currentItem = items.find((i) => i.id === itemId);
    const trimmed = editText.trim();
    if (!currentItem || !trimmed || trimmed === currentItem.item_name) return;

    await supabase
      .from('grocery_items')
      .update({ item_name: trimmed })
      .eq('id', itemId);
  };

  const handleSend = async () => {
    const rawText = inputText.trim();
    if (!rawText || sending) return;

    const isDuplicate = items.some(
      (i) => i.item_name.trim().toLowerCase() === rawText.toLowerCase(),
    );
    if (isDuplicate) {
      Alert.alert('כבר קיים', `"${rawText}" כבר ברשימה.`);
      return;
    }

    const { data: sessionData } = await supabase.auth.getSession();
    console.log(
      '[handleSend] session:',
      JSON.stringify(sessionData?.session?.user?.id ?? 'NO SESSION'),
    );

    setSending(true);
    setSuggestions([]);

    const exactMatch = suggestions.find(
      (s) => s.name.toLowerCase() === rawText.toLowerCase(),
    );
    const categoryToUse = suggestedCategory ?? exactMatch?.category ?? null;

    const insertPayload = {
      item_name: rawText,
      category: categoryToUse ?? FALLBACK_CATEGORY,
      checked: false,
    };
    console.log('[handleSend] inserting:', JSON.stringify(insertPayload));

    const { data: insertData, error: insertError } = await supabase
      .from('grocery_items')
      .insert(insertPayload)
      .select('id')
      .single();
    console.log(
      '[handleSend] insert result — data:',
      JSON.stringify(insertData),
      'error:',
      JSON.stringify(insertError),
    );

    if (insertError) {
      Alert.alert('שגיאה', 'לא הצלחנו להוסיף את המוצר. נסו שוב.');
      setSending(false);
      return;
    }

    // Show the item immediately without waiting for Realtime
    optimisticInsert({
      id: insertData.id,
      item_name: rawText,
      category: categoryToUse ?? FALLBACK_CATEGORY,
      checked: false,
      created_at: new Date().toISOString(),
    });

    setInputText('');
    setSuggestedCategory(null);
    setSending(false);

    // Skip /categorize when autocomplete already gave us a confirmed category
    if (categoryToUse) {
      console.log('[handleSend] category from autocomplete, skipping /categorize');
      return;
    }

    const insertedId = insertData?.id;
    if (!insertedId) return;

    const apiUrl = `${process.env.EXPO_PUBLIC_API_BASE_URL}/categorize`;
    console.log('[handleSend] calling /categorize (background)', { apiUrl, item_name: rawText });

    try {
      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ item_name: rawText }),
      });
      console.log('[handleSend] /categorize response status:', res.status);
      if (!res.ok) return;

      const data = await res.json();
      const category = data.category;
      console.log('[handleSend] category from API:', category);

      if (!category || category === FALLBACK_CATEGORY) return;

      optimisticUpdate(insertedId, { category });

      const { error: updateError } = await supabase
        .from('grocery_items')
        .update({ category })
        .eq('id', insertedId);
      console.log(
        '[handleSend] background category update error:',
        JSON.stringify(updateError),
      );
    } catch (e) {
      console.log('[handleSend] /categorize fetch error (background):', e);
    }
  };

  const handleDelete = (item: GroceryItem) => {
    Alert.alert('מחיקה', `למחוק את "${item.item_name}"?`, [
      { text: 'ביטול', style: 'cancel' },
      {
        text: 'מחק',
        style: 'destructive',
        onPress: () => {
          optimisticDelete(item.id);
          supabase.from('grocery_items').delete().eq('id', item.id);
        },
      },
    ]);
  };

  const handleToggleCheck = (item: GroceryItem) => {
    optimisticUpdate(item.id, { checked: true });
    supabase.from('grocery_items').update({ checked: true }).eq('id', item.id);
  };

  const handleUncheck = (item: GroceryItem) => {
    optimisticUpdate(item.id, { checked: false });
    supabase.from('grocery_items').update({ checked: false }).eq('id', item.id);
  };

  const handleCategoryChange = async (
    item: GroceryItem,
    newCategory: string,
  ) => {
    setEditingItem(null);
    await correctCategory({
      itemId: item.id,
      itemName: item.item_name,
      newCategory,
    });
  };

  const grouped = groupByCategory(items);

  if (loading && items.length === 0) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>שגיאה בטעינת הרשימה</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <Text style={styles.header}>רשימת קניות</Text>

      {/* ── Input bar ── */}
      <View
        style={styles.inputBar}
        onLayout={(e) => setInputBarBottom(e.nativeEvent.layout.y + e.nativeEvent.layout.height)}
      >
        <TextInput
          style={styles.textInput}
          value={inputText}
          onChangeText={onInputChange}
          placeholder="הוסיפו מוצר..."
          placeholderTextColor="#999"
          editable={!sending}
          onSubmitEditing={handleSend}
          returnKeyType="send"
        />

        {sending ? (
          <ActivityIndicator
            size="small"
            color="#4a90d9"
            style={styles.sendButton}
          />
        ) : (
          <TouchableOpacity
            style={[
              styles.sendButton,
              !inputText.trim() && styles.sendButtonDisabled,
            ]}
            onPress={handleSend}
            disabled={!inputText.trim()}
          >
            <Text style={styles.sendButtonText}>שלח</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* ── Autocomplete suggestions (overlay — does not push list down) ── */}
      {suggestions.length > 0 && (
        <View style={[styles.suggestionsPanel, { top: inputBarBottom }]} pointerEvents="box-none">
          {suggestions.map((s) => (
            <TouchableOpacity
              key={s.name}
              style={styles.suggestionItem}
              onPress={() => onSuggestionTap(s)}
            >
              <Text style={styles.suggestionName}>{s.name}</Text>
              <View style={styles.suggestionBadge}>
                <Text style={styles.suggestionBadgeText}>{s.category}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {items.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyText}>הרשימה ריקה</Text>
          <Text style={styles.emptyHint}>הוסיפו מוצרים דרך הצ׳אט למטה</Text>
        </View>
      ) : (
        <FlatList
          data={grouped}
          keyExtractor={(group) => group.category}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item: group }) => (
            <View style={styles.categorySection}>
              <Text style={styles.categoryHeader}>{group.category}</Text>

              {group.unchecked.map((item) => (
                <ItemRow
                  key={item.id}
                  item={item}
                  onToggleCheck={handleToggleCheck}
                  onEditCategory={setEditingItem}
                  onDelete={handleDelete}
                  isEditing={editingItemId === item.id}
                  editText={editText}
                  onStartEdit={startEditing}
                  onEditTextChange={setEditText}
                  onEditSubmit={saveEdit}
                />
              ))}

              {group.checked.length > 0 && (
                <>
                  <TouchableOpacity
                    style={styles.checkedSectionHeader}
                    onPress={() => toggleExpandedChecked(group.category)}
                  >
                    <Text style={styles.checkedSectionText}>
                      נסמנו ({group.checked.length})
                    </Text>
                    <Text style={styles.chevron}>
                      {expandedChecked.has(group.category) ? '▲' : '▼'}
                    </Text>
                  </TouchableOpacity>

                  {expandedChecked.has(group.category) &&
                    group.checked.map((item) => (
                      <CheckedItemRow
                        key={item.id}
                        item={item}
                        onUncheck={handleUncheck}
                        onDelete={handleDelete}
                      />
                    ))}
                </>
              )}
            </View>
          )}
        />
      )}

      <Modal
        visible={editingItem !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setEditingItem(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>בחרו קטגוריה</Text>
            <FlatList
              data={CATEGORIES as unknown as string[]}
              keyExtractor={(cat) => cat}
              renderItem={({ item: cat }) => (
                <TouchableOpacity
                  style={[
                    styles.modalOption,
                    editingItem?.category === cat && styles.modalOptionSelected,
                  ]}
                  onPress={() =>
                    editingItem && handleCategoryChange(editingItem, cat)
                  }
                >
                  <Text
                    style={[
                      styles.modalOptionText,
                      editingItem?.category === cat &&
                        styles.modalOptionTextSelected,
                    ]}
                  >
                    {cat}
                  </Text>
                </TouchableOpacity>
              )}
            />
            <TouchableOpacity
              style={styles.modalCancel}
              onPress={() => setEditingItem(null)}
            >
              <Text style={styles.modalCancelText}>ביטול</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  header: {
    fontFamily: 'Assistant_700Bold',
    fontSize: 28,
    color: '#1a1a2e',
    paddingTop: 60,
    paddingBottom: 16,
    paddingHorizontal: 20,
    backgroundColor: '#fff',
    writingDirection: 'rtl',
  },
  emptyText: {
    fontFamily: 'Assistant_600SemiBold',
    fontSize: 20,
    color: '#888',
    writingDirection: 'rtl',
  },
  emptyHint: {
    fontFamily: 'Assistant_400Regular',
    fontSize: 16,
    color: '#aaa',
    marginTop: 8,
    writingDirection: 'rtl',
  },
  errorText: {
    fontFamily: 'Assistant_600SemiBold',
    fontSize: 18,
    color: '#e74c3c',
    writingDirection: 'rtl',
  },
  categorySection: {
    marginTop: 12,
    marginHorizontal: 12,
  },
  categoryHeader: {
    fontFamily: 'Assistant_700Bold',
    fontSize: 18,
    color: '#4a90d9',
    marginBottom: 6,
    writingDirection: 'rtl',
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 12,
    marginBottom: 6,
    gap: 14,
  },
  deleteButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#fee2e2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteIcon: {
    fontSize: 13,
    color: '#e74c3c',
    fontWeight: 'bold',
  },
  checkButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#4a90d9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkIcon: {
    fontSize: 18,
    color: '#4a90d9',
  },
  itemNameButton: {
    flex: 1,
  },
  itemName: {
    fontFamily: 'Assistant_400Regular',
    fontSize: 17,
    color: '#333',
    writingDirection: 'rtl',
  },
  itemNameInput: {
    flex: 1,
    fontFamily: 'Assistant_400Regular',
    fontSize: 17,
    color: '#333',
    writingDirection: 'rtl',
    textAlign: 'right',
    borderBottomWidth: 1.5,
    borderBottomColor: '#4a90d9',
    paddingVertical: 2,
    paddingHorizontal: 0,
  },
  categoryBadge: {
    backgroundColor: '#e8f0fe',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  categoryBadgeText: {
    fontFamily: 'Assistant_400Regular',
    fontSize: 13,
    color: '#4a90d9',
    writingDirection: 'rtl',
  },
  checkedSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 4,
    gap: 6,
  },
  checkedSectionText: {
    fontFamily: 'Assistant_600SemiBold',
    fontSize: 14,
    color: '#999',
    writingDirection: 'rtl',
  },
  chevron: {
    fontSize: 12,
    color: '#999',
  },
  checkedItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
    borderRadius: 10,
    padding: 10,
    marginBottom: 4,
    gap: 14,
  },
  checkedRowMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  checkedCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#4a90d9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkedIcon: {
    fontSize: 14,
    color: '#fff',
    fontWeight: 'bold',
  },
  checkedItemName: {
    flex: 1,
    fontFamily: 'Assistant_400Regular',
    fontSize: 16,
    color: '#aaa',
    textDecorationLine: 'line-through',
    writingDirection: 'rtl',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '70%',
  },
  modalTitle: {
    fontFamily: 'Assistant_700Bold',
    fontSize: 22,
    color: '#1a1a2e',
    textAlign: 'center',
    marginBottom: 16,
    writingDirection: 'rtl',
  },
  modalOption: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 10,
    marginBottom: 4,
  },
  modalOptionSelected: {
    backgroundColor: '#e8f0fe',
  },
  modalOptionText: {
    fontFamily: 'Assistant_400Regular',
    fontSize: 18,
    color: '#333',
    writingDirection: 'rtl',
  },
  modalOptionTextSelected: {
    fontFamily: 'Assistant_600SemiBold',
    color: '#4a90d9',
  },
  modalCancel: {
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  modalCancelText: {
    fontFamily: 'Assistant_600SemiBold',
    fontSize: 18,
    color: '#999',
    writingDirection: 'rtl',
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  textInput: {
    flex: 1,
    fontFamily: 'Assistant_400Regular',
    fontSize: 16,
    backgroundColor: '#f5f5f5',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#ddd',
    writingDirection: 'rtl',
    textAlign: 'right',
    color: '#333',
  },
  sendButton: {
    marginLeft: 8,
    backgroundColor: '#4a90d9',
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
  sendButtonText: {
    fontFamily: 'Assistant_600SemiBold',
    fontSize: 16,
    color: '#fff',
    writingDirection: 'rtl',
  },
  // ── Autocomplete ──────────────────────────────────────────────────────────
  suggestionsPanel: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 100,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    elevation: 4,        // Android shadow
    shadowColor: '#000', // iOS shadow
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: '#f5f5f5',
    gap: 8,
  },
  suggestionName: {
    flex: 1,
    fontFamily: 'Assistant_400Regular',
    fontSize: 16,
    color: '#333',
    writingDirection: 'rtl',
    textAlign: 'right',
  },
  suggestionBadge: {
    backgroundColor: '#e8f0fe',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  suggestionBadgeText: {
    fontFamily: 'Assistant_400Regular',
    fontSize: 12,
    color: '#4a90d9',
  },
});
