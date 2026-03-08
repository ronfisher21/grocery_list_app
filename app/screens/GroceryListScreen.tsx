import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useGroceryItems, GroceryItem } from '../lib/useGroceryItems';
import { supabase } from '../lib/supabase';
import { useCorrectCategory } from '../hooks/useCorrectCategory';

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

interface GroupedItems {
  category: string;
  data: GroceryItem[];
}

function groupByCategory(items: GroceryItem[]): GroupedItems[] {
  const map = new Map<string, GroceryItem[]>();
  for (const item of items) {
    const list = map.get(item.category) || [];
    list.push(item);
    map.set(item.category, list);
  }
  // Sort by CATEGORIES order; unknown categories go last
  return Array.from(map.entries())
    .sort(([a], [b]) => {
      const ia = CATEGORIES.indexOf(a as typeof CATEGORIES[number]);
      const ib = CATEGORIES.indexOf(b as typeof CATEGORIES[number]);
      return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
    })
    .map(([category, data]) => ({ category, data }));
}

function ItemRow({
  item,
  onToggleCheck,
  onEditCategory,
}: {
  item: GroceryItem;
  onToggleCheck: (item: GroceryItem) => void;
  onEditCategory: (item: GroceryItem) => void;
}) {
  return (
    <View style={styles.itemRow}>
      <TouchableOpacity
        style={styles.checkButton}
        onPress={() => onToggleCheck(item)}
      >
        <Text style={styles.checkIcon}>○</Text>
      </TouchableOpacity>

      <Text style={styles.itemName}>{item.item_name}</Text>

      <TouchableOpacity
        style={styles.categoryBadge}
        onPress={() => onEditCategory(item)}
      >
        <Text style={styles.categoryBadgeText}>{item.category}</Text>
      </TouchableOpacity>
    </View>
  );
}

const FALLBACK_CATEGORY = 'מוצרים יבשים ושימורים';

export default function GroceryListScreen() {
  const { items, loading, error } = useGroceryItems();
  const { correctCategory } = useCorrectCategory();
  const [editingItem, setEditingItem] = useState<GroceryItem | null>(null);
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);

  const handleSend = async () => {
    const text = inputText.trim();
    if (!text || sending) return;

    const { data: sessionData } = await supabase.auth.getSession();
    console.log('[handleSend] session:', JSON.stringify(sessionData?.session?.user?.id ?? 'NO SESSION'));

    setSending(true);
    let category = FALLBACK_CATEGORY;

    const apiUrl = `${process.env.EXPO_PUBLIC_API_BASE_URL}/categorize`;
    console.log('[handleSend] calling /categorize', { apiUrl, item_name: text });

    try {
      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ item_name: text }),
      });
      console.log('[handleSend] /categorize response status:', res.status);
      if (res.ok) {
        const data = await res.json();
        category = data.category;
        console.log('[handleSend] category from API:', category);
      }
    } catch (e) {
      console.log('[handleSend] /categorize fetch error:', e);
      // use fallback category
    }

    const insertPayload = { item_name: text, category, checked: false };
    console.log('[handleSend] inserting into grocery_items:', JSON.stringify(insertPayload));

    const { data: insertData, error: insertError } = await supabase.from('grocery_items').insert(insertPayload);
    console.log('[handleSend] insert result — data:', JSON.stringify(insertData), 'error:', JSON.stringify(insertError));

    if (insertError) {
      Alert.alert('שגיאה', 'לא הצלחנו להוסיף את המוצר. נסו שוב.');
      setSending(false);
      return;
    }

    setInputText('');
    setSending(false);
  };

  const handleToggleCheck = async (item: GroceryItem) => {
    await supabase.from('grocery_items').delete().eq('id', item.id);
  };

  const handleCategoryChange = async (item: GroceryItem, newCategory: string) => {
    setEditingItem(null);
    await correctCategory({ itemId: item.id, itemName: item.item_name, newCategory });
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
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Text style={styles.header}>רשימת קניות</Text>

      <View style={styles.inputBar}>
        <TextInput
          style={styles.textInput}
          value={inputText}
          onChangeText={setInputText}
          placeholder="הוסיפו מוצר..."
          placeholderTextColor="#999"
          editable={!sending}
          onSubmitEditing={handleSend}
          returnKeyType="send"
        />
        {sending ? (
          <ActivityIndicator size="small" color="#4a90d9" style={styles.sendButton} />
        ) : (
          <TouchableOpacity
            style={[styles.sendButton, !inputText.trim() && styles.sendButtonDisabled]}
            onPress={handleSend}
            disabled={!inputText.trim()}
          >
            <Text style={styles.sendButtonText}>שלח</Text>
          </TouchableOpacity>
        )}
      </View>

      {items.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyText}>הרשימה ריקה</Text>
          <Text style={styles.emptyHint}>הוסיפו מוצרים דרך הצ׳אט למטה</Text>
        </View>
      ) : (
        <FlatList
          data={grouped}
          keyExtractor={(group) => group.category}
          renderItem={({ item: group }) => (
            <View style={styles.categorySection}>
              <Text style={styles.categoryHeader}>{group.category}</Text>
              {group.data.map((item) => (
                <ItemRow
                  key={item.id}
                  item={item}
                  onToggleCheck={handleToggleCheck}
                  onEditCategory={setEditingItem}
                />
              ))}
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
  },
  checkButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#4a90d9',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
  },
  checkIcon: {
    fontSize: 18,
    color: '#4a90d9',
  },
  itemName: {
    flex: 1,
    fontFamily: 'Assistant_400Regular',
    fontSize: 17,
    color: '#333',
    writingDirection: 'rtl',
  },
  categoryBadge: {
    backgroundColor: '#e8f0fe',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginRight: 8,
  },
  categoryBadgeText: {
    fontFamily: 'Assistant_400Regular',
    fontSize: 13,
    color: '#4a90d9',
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
});
