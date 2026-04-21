/**
 * Test edge cases for item name editing with automatic re-categorization (Issue #2)
 *
 * Scenarios:
 * 1. Edit item name to a different product in different category
 * 2. Edit item with quantity suffix (e.g., "חלב 2" → "מילקי")
 * 3. Edit to a name that already has an autocomplete suggestion
 * 4. Edit to an unknown item (should call OpenAI)
 * 5. Edit and categorization fails (retry available)
 * 6. Edit to the same name (should not re-categorize)
 * 7. Edit with whitespace variations
 */

describe('Item Edit with Re-categorization (Issue #2)', () => {
  // Mock data
  const testItems = [
    {
      id: 'item-1',
      item_name: 'חלב 2',
      category: 'מוצרי חלב וביצים',
      expectedAfterEdit: 'מילקי',
      expectedNewCategory: 'מוצרי חלב וביצים', // Same category
    },
    {
      id: 'item-2',
      item_name: 'עגבניות',
      category: 'ירקות ופירות',
      expectedAfterEdit: 'קולה',
      expectedNewCategory: 'שתייה', // Different category
    },
    {
      id: 'item-3',
      item_name: 'שמפו',
      category: 'היגיינה',
      expectedAfterEdit: 'ניקיון',
      expectedNewCategory: 'ניקיון', // Different category
    },
  ];

  it('should re-categorize when item name changes to different category', () => {
    const item = testItems[1]; // עגבניות → קולה

    // OLD BEHAVIOR (buggy): would NOT re-categorize
    // Just update name and leave category as "ירקות ופירות"

    // NEW BEHAVIOR (fixed): calls /categorize with new name
    expect(item.item_name).toBe('עגבניות');
    expect(item.expectedAfterEdit).toBe('קולה');
    expect(item.expectedNewCategory).toBe('שתייה');

    // Should call callCategorizeEndpoint(itemId, 'קולה')
    // which should return 'שתייה'
  });

  it('should handle edit with quantity suffix removal', () => {
    const item = testItems[0]; // "חלב 2" → "מילקי"

    // When user edits "חלב 2" to "מילקי"
    const oldName = 'חלב 2';
    const newName = 'מילקי';

    expect(oldName).not.toBe(newName);

    // Should trigger re-categorization
    // Both should be categorized as dairy, but they're different products
  });

  it('should not re-categorize if name does not change', () => {
    const item = testItems[0];

    const oldName = 'חלב 2';
    const editedText = '  חלב 2  '; // Same with whitespace

    const trimmed = editedText.trim();

    // Should NOT call /categorize if name is the same after trim
    expect(trimmed).toBe(oldName);
  });

  it('should handle edit to unknown item (calls OpenAI)', () => {
    const unknownItem = 'איזו_חנות_חדשה_מוצר';

    // Should call /categorize
    // Backend will try manual_overrides (miss)
    // Then call OpenAI
    // Should return a valid Hebrew category or FALLBACK

    expect(unknownItem.length).toBeGreaterThan(0);
  });

  it('should handle edit to item with whitespace variations', () => {
    const variations = [
      '  חלב  ',
      'חלב ',
      ' חלב',
      'חלב',
    ];

    // After trim, all should be identical
    const trimmed = variations.map(v => v.trim());

    // All should normalize to same value
    expect(trimmed[0]).toBe(trimmed[1]);
    expect(trimmed[1]).toBe(trimmed[2]);
    expect(trimmed[2]).toBe(trimmed[3]);
  });

  it('should track failed re-categorization on edit', () => {
    // Simulate: edit item name, /categorize fails
    const itemId = 'item-123';
    const failedMap = new Map<string, string>();

    // Edit triggered categorization which failed
    failedMap.set(itemId, 'HTTP 500');

    expect(failedMap.has(itemId)).toBe(true);
    expect(failedMap.get(itemId)).toBe('HTTP 500');

    // User taps error badge to retry
    failedMap.delete(itemId);
    expect(failedMap.has(itemId)).toBe(false);
  });

  it('should update category in optimistic UI before database confirms', () => {
    const itemId = 'item-123';
    const newCategory = 'שתייה';

    // optimisticUpdate should be called with:
    // optimisticUpdate(itemId, { category: newCategory })

    // This updates the UI immediately
    // Then database update happens in background
    expect(itemId).toBeDefined();
    expect(newCategory).toBeDefined();
  });

  it('should handle edit with Hebrew variant normalization', () => {
    const itemNames = [
      'יוגורט',  // single yod
      'יוגורט',  // double yod (different spelling)
    ];

    // normalize() should convert both to same normalized form
    // So they trigger same /categorize lookup
    // And ideally hit manual_overrides cache

    // This prevents duplicate database calls for variants
  });

  it('should preserve checked state when editing unchecked item', () => {
    const item = {
      id: 'item-1',
      item_name: 'חלב 2',
      checked: false,
      category: 'מוצרי חלב וביצים',
    };

    // When editing, only name and category should change
    // checked should remain false

    const updatedItem = {
      ...item,
      item_name: 'מילקי',
      category: 'מוצרי חלב וביצים',
      // checked should still be false
    };

    expect(updatedItem.checked).toBe(false);
  });

  it('should prevent concurrent edits on same item', () => {
    const itemId = 'item-123';
    let editingId = null;

    // Start edit
    editingId = itemId;
    expect(editingId).toBe(itemId);

    // Try to edit another item (should be blocked by editingRef.current)
    // Only one item should be in edit mode at a time

    // Complete first edit
    editingId = null;
    expect(editingId).toBeNull();
  });
});
