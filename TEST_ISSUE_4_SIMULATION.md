# Issue #4 Testing: Response Parsing Robustness

## Overview
The `/categorize` endpoint should handle edge cases in responses robustly, including:
- Malformed JSON
- Missing fields
- Wrong data types
- Invalid values
- Extremely large responses
- Missing API configuration

---

## Test Scenarios

### Scenario 1: Malformed JSON Response
**Setup:** Backend returns invalid JSON

**Steps:**
1. Mock backend to return `{invalid json}` (not valid JSON)
2. Add item "לבן"
3. Observe error handling

**Expected Behavior:**
- ✅ JSON parse error is caught
- ✅ Badge shows ⚠️
- ✅ Error message: "Invalid JSON response"
- ✅ App doesn't crash
- ✅ User can retry

**Expected Logs:**
```
[callCategorizeEndpoint] JSON parse error: SyntaxError: Unexpected token...
```

---

### Scenario 2: Response is Array Instead of Object
**Setup:** Backend returns `["מוצרי חלב וביצים"]` (array, not object)

**Steps:**
1. Mock endpoint to return array
2. Add item
3. Observe error handling

**Expected Behavior:**
- ✅ Response structure validation fails
- ✅ Badge shows ⚠️
- ✅ Error message: "Response is not an object"
- ✅ User can retry

**Expected Logs:**
```
[callCategorizeEndpoint] Invalid response structure: [...]
```

---

### Scenario 3: Response is Null
**Setup:** Backend returns `null`

**Steps:**
1. Mock endpoint to return null
2. Add item

**Expected Behavior:**
- ✅ Null check catches this
- ✅ Badge shows ⚠️
- ✅ Error message: "Response is not an object"

---

### Scenario 4: Missing Category Field
**Setup:** Backend returns `{ "quantity": 2 }` (no category field)

**Steps:**
1. Mock endpoint to return response without category
2. Add item

**Expected Behavior:**
- ✅ Missing field is detected
- ✅ Badge shows ⚠️
- ✅ Error message: "Invalid category type or empty: undefined"

**Expected Logs:**
```
[callCategorizeEndpoint] Invalid category: { type: 'undefined', value: undefined, ... }
```

---

### Scenario 5: Category is Null
**Setup:** Backend returns `{ "category": null }`

**Steps:**
1. Mock endpoint with null category
2. Add item

**Expected Behavior:**
- ✅ Type validation catches this
- ✅ Badge shows ⚠️
- ✅ Error message: "Invalid category type or empty: object"

---

### Scenario 6: Category is Number
**Setup:** Backend returns `{ "category": 123 }`

**Steps:**
1. Mock endpoint with numeric category
2. Add item

**Expected Behavior:**
- ✅ Type validation fails
- ✅ Badge shows ⚠️
- ✅ Error message: "Invalid category type or empty: number"

---

### Scenario 7: Category is Array
**Setup:** Backend returns `{ "category": ["מוצרי חלב וביצים"] }`

**Steps:**
1. Mock endpoint with array category
2. Add item

**Expected Behavior:**
- ✅ Type validation fails
- ✅ Badge shows ⚠️
- ✅ Error message: "Invalid category type or empty: object"

---

### Scenario 8: Category is Empty String
**Setup:** Backend returns `{ "category": "" }`

**Steps:**
1. Mock endpoint with empty string
2. Add item

**Expected Behavior:**
- ✅ Empty string validation fails
- ✅ Badge shows ⚠️
- ✅ Error message: "Invalid category type or empty: string"

---

### Scenario 9: Category is Whitespace Only
**Setup:** Backend returns `{ "category": "   " }`

**Steps:**
1. Mock endpoint with whitespace
2. Add item

**Expected Behavior:**
- ✅ Whitespace-only validation fails
- ✅ Badge shows ⚠️
- ✅ Cannot trim to valid value

---

### Scenario 10: Response Has Extra Fields
**Setup:** Backend returns valid category + extra fields

**Response:**
```json
{
  "category": "מוצרי חלב וביצים",
  "quantity": 2,
  "extra_field": "should be ignored",
  "_internal": "also ignored"
}
```

**Expected Behavior:**
- ✅ Extra fields are ignored
- ✅ Category is extracted correctly
- ✅ Item is categorized as "מוצרי חלב וביצים"

---

### Scenario 11: Missing API_BASE_URL Configuration
**Setup:** Environment variable `EXPO_PUBLIC_API_BASE_URL` is not set

**Steps:**
1. Unset `EXPO_PUBLIC_API_BASE_URL`
2. Add item
3. Observe behavior

**Expected Behavior:**
- ✅ API endpoint configuration is checked
- ✅ Error is detected early
- ✅ Badge shows ⚠️
- ✅ Error message: "API endpoint not configured"
- ✅ User sees clear error instead of silent failure

**Expected Logs:**
```
[callCategorizeEndpoint] Missing API_BASE_URL
```

---

### Scenario 12: Input Validation - Invalid ItemId
**Setup:** Somehow itemId is corrupted/invalid

**Conditions to test:**
- itemId is empty string
- itemId is null
- itemId is number
- itemId is undefined

**Expected Behavior:**
- ✅ Input validation catches this
- ✅ No fetch call is made
- ✅ Early error detection

**Expected Logs:**
```
[callCategorizeEndpoint] Invalid itemId: [value]
```

---

### Scenario 13: Input Validation - Invalid ItemName
**Setup:** Item name is invalid

**Conditions to test:**
- itemName is empty string
- itemName is whitespace only
- itemName is null
- itemName is number

**Expected Behavior:**
- ✅ Input validation catches this
- ✅ No fetch call is made
- ✅ Error is set early
- ✅ User sees clear error

**Expected Logs:**
```
[callCategorizeEndpoint] Invalid itemName: [value]
```

---

### Scenario 14: Extremely Large Response (100KB+)
**Setup:** Backend returns very large category string

**Steps:**
1. Mock endpoint to return 100KB+ category string
2. Add item

**Expected Behavior:**
- ✅ App doesn't crash on large data
- ✅ Response is processed (though may be unusual)
- ✅ No memory issues
- ✅ Could log warning about size

**Defense:**
- Consider adding max length check if needed
- But for now, should at least not crash

---

### Scenario 15: Category is Boolean
**Setup:** Backend returns `{ "category": true }`

**Steps:**
1. Mock endpoint with boolean category
2. Add item

**Expected Behavior:**
- ✅ Type validation fails
- ✅ Badge shows ⚠️
- ✅ Error message: "Invalid category type or empty: boolean"

---

## Manual Testing Checklist

- [ ] Test Scenario 1 (Malformed JSON)
- [ ] Test Scenario 2 (Array Response)
- [ ] Test Scenario 3 (Null Response)
- [ ] Test Scenario 4 (Missing Category)
- [ ] Test Scenario 5 (Null Category)
- [ ] Test Scenario 6 (Number Category)
- [ ] Test Scenario 7 (Array Category)
- [ ] Test Scenario 8 (Empty String Category)
- [ ] Test Scenario 9 (Whitespace Category)
- [ ] Test Scenario 10 (Extra Fields)
- [ ] Test Scenario 11 (Missing API Config)
- [ ] Test Scenario 12 (Invalid ItemId)
- [ ] Test Scenario 13 (Invalid ItemName)
- [ ] Test Scenario 14 (Huge Response)
- [ ] Test Scenario 15 (Boolean Category)

---

## Console Logs to Monitor

### Input Validation
```javascript
[callCategorizeEndpoint] Invalid itemId: ...
[callCategorizeEndpoint] Invalid itemName: ...
[callCategorizeEndpoint] Missing API_BASE_URL
```

### HTTP Errors
```javascript
[callCategorizeEndpoint] Response status: 500
[callCategorizeEndpoint] HTTP error: HTTP 500
```

### Parse Errors
```javascript
[callCategorizeEndpoint] JSON parse error: SyntaxError...
[callCategorizeEndpoint] Invalid response structure: ...
[callCategorizeEndpoint] Invalid category: { type: '...', value: ..., isEmpty: ... }
```

### Success
```javascript
[callCategorizeEndpoint] Returned category: מוצרי חלב וביצים
[callCategorizeEndpoint] Database update successful
```

---

## How to Simulate Edge Cases

### Using Postman or curl
Mock the backend with different responses:

```bash
# Test malformed JSON
curl -X POST http://localhost:8000/categorize \
  -H "Content-Type: application/json" \
  -d "{invalid json"

# Test missing category
curl -X POST http://localhost:8000/categorize \
  -H "Content-Type: application/json" \
  -d '{"quantity": 2}'

# Test null category
curl -X POST http://localhost:8000/categorize \
  -H "Content-Type: application/json" \
  -d '{"category": null}'

# Test array response
curl -X POST http://localhost:8000/categorize \
  -H "Content-Type: application/json" \
  -d '["מוצרי חלב וביצים"]'
```

### Using Network Mock (Advanced)
Intercept responses with proxy:
```bash
# Use mitmproxy or similar to intercept and modify responses
mitmproxy --mode transparent
# Intercept /categorize responses and corrupt them
```

### Modifying Backend (For Testing)
Temporarily add debug endpoints:
```python
# In backend/api.py
@app.get("/categorize/mock/{scenario}")
def categorize_mock(scenario: str):
    if scenario == "malformed":
        return "invalid json"
    elif scenario == "missing":
        return {"quantity": 2}
    elif scenario == "null":
        return {"category": None}
    # ... etc
```

Then in frontend:
```typescript
const apiUrl = `http://api/categorize/mock/${scenario}`;
// Test different scenarios
```

---

## Success Criteria

✅ **All tests pass:** Response parsing handles all edge cases  
✅ **No crashes:** Malformed responses don't crash the app  
✅ **Clear errors:** Users see error badges with retry option  
✅ **Input validation:** Invalid inputs are caught early  
✅ **Graceful degradation:** App stays functional even with bad responses  
✅ **Logs help debugging:** Console logs make issues clear
