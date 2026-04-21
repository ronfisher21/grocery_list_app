# Issue #1 Testing: Backend API Failure & Retry Mechanism

## Overview
This document describes how to manually test the error handling for Issue #1.

## Test Scenarios

### Scenario 1: Network Timeout
**Setup:** Mock the backend to timeout

**Steps:**
1. Start the app
2. Simulate a slow/hanging API by blocking the backend
3. Add a new item (e.g., "לבן")
4. Watch the UI:
   - Item should be inserted with FALLBACK category
   - Category badge should show ⏳ (loading indicator)
   - After timeout, badge should show ⚠️ (error indicator)
5. Tap the warning badge to retry
6. After retry succeeds, badge should show correct category

**Expected Behavior:**
- ❌ Item does NOT stay stuck (previously buggy)
- ✅ User can see it failed (⚠️ badge)
- ✅ User can retry (tap badge)
- ✅ Logs show the error message

**Logs to check:**
```
[callCategorizeEndpoint] Network/exception error: [error details]
[callCategorizeEndpoint] Calling /categorize for: לבן
[retryCategorizationForItem] Retrying categorization for: לבן
```

---

### Scenario 2: HTTP 500 Backend Error
**Setup:** Mock backend to return HTTP 500

**Steps:**
1. Start the app
2. Add backend error simulation (modify EXPO_PUBLIC_API_BASE_URL temporarily)
3. Add a new item
4. Observe badge shows ⚠️
5. Tap to retry
6. Retry should eventually succeed

**Expected Behavior:**
- ✅ Error is caught and displayed
- ✅ Logs show: "HTTP 500"
- ✅ Item is NOT lost or left in inconsistent state

**Logs to check:**
```
[callCategorizeEndpoint] Response status: 500
[callCategorizeEndpoint] HTTP error: HTTP 500
```

---

### Scenario 3: Malformed JSON Response
**Setup:** Mock backend to return invalid JSON

**Steps:**
1. Start the app
2. Add item
3. Observe error handling

**Expected Behavior:**
- ✅ JSON parse error is caught
- ✅ Badge shows ⚠️
- ✅ Error message: "Invalid JSON response"
- ✅ User can retry

**Logs to check:**
```
[callCategorizeEndpoint] JSON parse error: SyntaxError
```

---

### Scenario 4: Missing Category Field
**Setup:** Backend returns valid JSON but no `category` field

**Steps:**
1. Add item with malformed response
2. Observe error handling

**Expected Behavior:**
- ✅ Badge shows ⚠️
- ✅ Error message: "Empty category in response"
- ✅ User can retry

**Logs to check:**
```
[callCategorizeEndpoint] Empty category
```

---

### Scenario 5: Successful Categorization (Control Test)
**Setup:** Normal operation

**Steps:**
1. Start the app
2. Add item "לבן"
3. Observe correct categorization

**Expected Behavior:**
- ✅ Badge shows ⏳ briefly
- ✅ Badge changes to "מוצרי חלב וביצים"
- ✅ Item is saved to database
- ✅ No ⚠️ error badge

**Logs to check:**
```
[callCategorizeEndpoint] Returned category: מוצרי חלב וביצים
[callCategorizeEndpoint] Database update successful
```

---

### Scenario 6: Retry After Failure
**Setup:** Item failed to categorize, backend is now working

**Steps:**
1. Add item (backend is down)
2. Wait for error badge ⚠️
3. Bring backend back online
4. Tap the error badge to retry
5. Observe successful categorization

**Expected Behavior:**
- ✅ Item is NOT stuck in FALLBACK forever
- ✅ Retry works and updates item correctly
- ✅ Error badge disappears and shows correct category

**Logs to check:**
```
[retryCategorizationForItem] Retrying categorization for: [item]
[callCategorizeEndpoint] Calling /categorize for: [item]
[callCategorizeEndpoint] Database update successful
```

---

### Scenario 7: The Old Bug (Control - Should NOT happen)
**Setup:** Previous behavior where /categorize returned FALLBACK

**OLD BEHAVIOR (BUGGY):**
```typescript
if (category === FALLBACK_CATEGORY) {
  console.log('skipping update');
  return; // BUG: item never updated
}
```

**NEW BEHAVIOR (FIXED):**
- ✅ Always update, even if category is FALLBACK
- ✅ Item is persisted to database
- ✅ User can manually correct via category picker

**Verification:**
- Add item that causes OpenAI to return FALLBACK
- ✅ Item is still saved to database
- ✅ User can tap category badge and manually correct

---

## Manual Testing Checklist

- [ ] Test Scenario 1 (Network Timeout)
- [ ] Test Scenario 2 (HTTP 500)
- [ ] Test Scenario 3 (Malformed JSON)
- [ ] Test Scenario 4 (Missing Category)
- [ ] Test Scenario 5 (Normal Operation)
- [ ] Test Scenario 6 (Retry After Failure)
- [ ] Test Scenario 7 (Old Bug - Should NOT occur)

## Console Logs to Monitor

Watch the console for these log patterns:

```javascript
// Successful
[callCategorizeEndpoint] Returned category: מוצרי חלב וביצים
[callCategorizeEndpoint] Database update successful

// Failures
[callCategorizeEndpoint] HTTP error: HTTP 500
[callCategorizeEndpoint] Network/exception error: [details]
[callCategorizeEndpoint] JSON parse error: [details]

// Retries
[retryCategorizationForItem] Retrying categorization for: [item]
```

## State Changes to Observe

### `pendingCategorizations` Set
- Should contain item ID while waiting for /categorize
- Should be cleared after response (success or failure)

### `failedCategorizations` Map
- Should have entry `itemId -> errorMessage` on failure
- Should be cleared on successful retry

### UI Changes
- Badge: empty → ⏳ (pending) → category (success) OR ⚠️ (error)
- Tap ⚠️ to retry: pending again → success or error

---

## How to Simulate Network Issues

### Option 1: Disable Backend
```bash
# Stop the backend
pkill -f uvicorn

# Add item in app → timeout after ~30s
# Restart backend
cd core && uvicorn main:app --reload

# Tap error badge to retry
```

### Option 2: Use Network Throttling (Chrome DevTools)
If testing via web:
1. Open DevTools
2. Network tab → Throttling → Slow 3G
3. Add item → observe timeout behavior

### Option 3: Proxy Mock (Advanced)
Create a local proxy that returns errors on demand
```bash
# Intercept and mock errors
# (e.g., using mitmproxy or custom Node server)
```

---

## Success Criteria

✅ **All tests pass:** User can add items and see failures/retries work correctly  
✅ **No silent failures:** Every error is visible to user  
✅ **Retry works:** Failed items can be retried by tapping badge  
✅ **No regression:** Normal operation (Scenario 5) still works  
✅ **Old bug fixed:** Items don't stay stuck in FALLBACK anymore
