# Issue #2 Testing: Item Name Editing with Re-categorization

## Overview
When users edit item names, the category should be automatically recalculated via /categorize endpoint.

**Previous Behavior (Buggy):**
- User edits "חלב 2" → "שמנת"
- Category stays as "מוצרי חלב וביצים" (correct by coincidence)
- User edits "עגבניות" → "קולה"
- Category stays as "ירקות ופירות" (WRONG - should be "שתייה")

**New Behavior (Fixed):**
- User edits item name
- /categorize is automatically called with new name
- Category is updated based on new name
- If categorization fails, shows error badge with retry option

---

## Test Scenarios

### Scenario 1: Edit to Different Category
**Setup:** Item in one category, edit to product in different category

**Steps:**
1. Add item "עגבניות" (צריך להתקבל as "ירקות ופירות")
2. Tap item name to edit
3. Change to "קולה"
4. Press done/submit
5. Observe:
   - ✅ Name changes to "קולה"
   - ✅ Badge shows ⏳ (re-categorizing)
   - ✅ Badge changes to "שתייה" (correct category)
   - ✅ Database is updated

**Expected Logs:**
```
[saveEdit] Updating item name from: עגבניות to: קולה
[saveEdit] Name updated successfully, now re-categorizing...
[callCategorizeEndpoint] Calling /categorize for: קולה
[callCategorizeEndpoint] Returned category: שתייה
```

---

### Scenario 2: Edit with Quantity Removal
**Setup:** Item has quantity in name

**Steps:**
1. Add item "חלב 2"
2. Edit to "מילקי"
3. Submit

**Expected Behavior:**
- ✅ Name changes
- ✅ /categorize called with "מילקי"
- ✅ Both products are dairy, but may have different properties
- ✅ Category updated correctly

**Expected Logs:**
```
[saveEdit] Updating item name from: חלב 2 to: מילקי
[callCategorizeEndpoint] Calling /categorize for: מילקי
```

---

### Scenario 3: Edit but Don't Change Name
**Setup:** User edits but name stays same (after trimming)

**Steps:**
1. Add item "שמנת"
2. Tap to edit
3. Add whitespace: "  שמנת  "
4. Submit

**Expected Behavior:**
- ✅ /categorize is NOT called (name is the same after trim)
- ✅ No unnecessary API call
- ✅ Item stays as-is

**Expected Logs:**
```
// Should NOT see these logs for this scenario:
[callCategorizeEndpoint] Calling /categorize for: שמנת
```

---

### Scenario 4: Edit to Unknown Item
**Setup:** Edit to product not in suggestions

**Steps:**
1. Add item "תפוח"
2. Edit to "איזה_מוצר_לא_ידוע_123"
3. Submit

**Expected Behavior:**
- ✅ /categorize called
- ✅ Backend tries manual_overrides (miss)
- ✅ Calls OpenAI
- ✅ Returns valid Hebrew category or FALLBACK
- ✅ Category is updated

**Expected Logs:**
```
[callCategorizeEndpoint] Calling /categorize for: איזה_מוצר_לא_ידוע_123
[callCategorizeEndpoint] Returned category: [some category]
```

---

### Scenario 5: Edit but Re-categorization Fails
**Setup:** Edit succeeds, but /categorize fails

**Steps:**
1. Add item "חלב"
2. Edit to "מילקי"
3. Submit while backend is down
4. Observe error badge
5. Bring backend back online
6. Tap error badge to retry

**Expected Behavior:**
- ✅ Name is updated to "מילקי"
- ✅ Category badge shows ⚠️ (categorization failed)
- ✅ Tap to retry works
- ✅ Category is updated on successful retry

**Expected Logs:**
```
[saveEdit] Name updated successfully, now re-categorizing...
[callCategorizeEndpoint] Network/exception error: [details]
[retryCategorizationForItem] Retrying categorization for: מילקי
[callCategorizeEndpoint] Database update successful
```

---

### Scenario 6: Edit Preserves Checked State
**Setup:** Checked item is edited

**Steps:**
1. Add item "חלב"
2. Check it (✓)
3. Edit name to "מילקי"
4. Submit
5. Observe:
   - ✅ Item is still checked (✓)
   - ✅ Name is "מילקי"
   - ✅ Category is updated

**Expected Behavior:**
- Only `item_name` and `category` change
- `checked` state is preserved

---

### Scenario 7: Rapid Edits
**Setup:** User edits name multiple times quickly

**Steps:**
1. Add item "חלב"
2. Edit to "מילקי" (quickly tap edit again before first save)
3. Edit again to "דני" without waiting

**Expected Behavior:**
- ✅ Each edit is independent
- ✅ Last edit's categorization is the one that's used
- ✅ No race conditions in UI

---

### Scenario 8: Edit with Hebrew Variant Spelling
**Setup:** Edit item with variant Hebrew spelling

**Steps:**
1. Add "יוגורט" (with one yod)
2. Edit to "יוגורט" (with double yod)
3. Submit

**Expected Behavior:**
- ✅ Both spelled "יוגורט" (variant normalization)
- ✅ Should hit manual_overrides cache (same normalized form)
- ✅ Fast /categorize response

**How it works:**
- Frontend normalize() and backend normalize() should match
- Both normalize double-yod to single yod
- So both spellings lookup same cache entry

---

## Manual Testing Checklist

- [ ] Test Scenario 1 (Different Category)
- [ ] Test Scenario 2 (Quantity Removal)
- [ ] Test Scenario 3 (No Name Change)
- [ ] Test Scenario 4 (Unknown Item)
- [ ] Test Scenario 5 (Re-categorization Fails)
- [ ] Test Scenario 6 (Checked State Preserved)
- [ ] Test Scenario 7 (Rapid Edits)
- [ ] Test Scenario 8 (Hebrew Variants)

---

## Console Logs to Monitor

```javascript
// Successful edit with re-categorization
[saveEdit] Updating item name from: עגבניות to: קולה
[saveEdit] Name updated successfully, now re-categorizing...
[callCategorizeEndpoint] Calling /categorize for: קולה
[callCategorizeEndpoint] Returned category: שתייה
[callCategorizeEndpoint] Database update successful

// Edit with no name change (should skip /categorize)
// No logs for callCategorizeEndpoint

// Edit with categorization failure
[saveEdit] Name updated successfully, now re-categorizing...
[callCategorizeEndpoint] Network/exception error: [details]
```

---

## State Changes to Observe

### Before Edit
```
Item: { id: 'x', item_name: 'עגבניות', category: 'ירקות ופירות', checked: false }
```

### During Edit
```
// User typing in text field
editingItemId = 'x'
editText = 'קולה'
```

### After Submitting Edit
```
// Name updated in database
Item: { ..., item_name: 'קולה', category: 'ירקות ופירות' }

// /categorize in progress
pendingCategorizations = Set { 'x' }
Badge: ⏳

// /categorize returns success
Item: { ..., item_name: 'קולה', category: 'שתייה' }
pendingCategorizations = Set {}
Badge: שתייה
```

---

## Data Flow Diagram

```
User taps item name
         ↓
Edit UI opens (editingItemId = 'x')
         ↓
User types new name
         ↓
User submits/done
         ↓
saveEdit() called
         ↓
UPDATE grocery_items SET item_name = 'new_name'
         ↓
callCategorizeEndpoint(itemId, 'new_name')
         ↓
POST /categorize with item_name='new_name'
         ↓
├─ Success: UPDATE grocery_items SET category = 'returned_category'
├─ Failure: Show error badge ⚠️
└─ Retry: Repeat from callCategorizeEndpoint()
```

---

## Success Criteria

✅ **All tests pass:** Edits trigger re-categorization  
✅ **Different categories:** Items change category when edited to different product  
✅ **No regression:** Normal edit still works  
✅ **Error handling:** Failed re-categorization shows error + retry  
✅ **State preserved:** Only name and category change, other fields preserved  
✅ **Performance:** No unnecessary /categorize calls when name doesn't change
