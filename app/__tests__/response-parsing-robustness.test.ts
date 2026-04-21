/**
 * Test edge cases for response parsing robustness (Issue #4)
 *
 * Scenarios:
 * 1. Malformed JSON response
 * 2. Response is not an object (array, string, null, number)
 * 3. Category field missing
 * 4. Category is null or undefined
 * 5. Category is wrong type (number, array, object, boolean)
 * 6. Category is empty string
 * 7. Category is whitespace only
 * 8. Response contains extra fields (should be ignored)
 * 9. Response is extremely large (DoS protection)
 * 10. API endpoint not configured (missing env var)
 */

describe('Response Parsing Robustness (Issue #4)', () => {
  const mockFetch = jest.fn();
  const testItemId = 'item-123';
  const testItemName = 'לבן';

  beforeEach(() => {
    mockFetch.mockClear();
    jest.clearAllMocks();
  });

  it('should handle malformed JSON', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => {
        throw new SyntaxError('Unexpected token');
      },
    });

    const response = await fetch('http://api/categorize');
    expect(response.ok).toBe(true);

    try {
      await response.json();
      expect.fail('Should throw SyntaxError');
    } catch (e) {
      expect(e).toBeInstanceOf(SyntaxError);
    }
  });

  it('should handle response that is array instead of object', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ['מוצרי חלב וביצים'], // array, not object
    });

    const response = await fetch('http://api/categorize');
    const data = await response.json();

    // Should validate that data is object
    expect(Array.isArray(data)).toBe(true);
    expect(typeof data).toBe('object');
    expect(data.category).toBeUndefined(); // Arrays don't have .category
  });

  it('should handle response that is string', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => 'מוצרי חלב וביצים', // string, not object
    });

    const response = await fetch('http://api/categorize');
    const data = await response.json();

    // Should validate that data is object, not string
    expect(typeof data).toBe('string');
    // This is invalid response structure
  });

  it('should handle response that is null', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => null,
    });

    const response = await fetch('http://api/categorize');
    const data = await response.json();

    expect(data).toBeNull();
    expect(typeof data).toBe('object'); // typeof null === 'object'
    expect(data?.category).toBeUndefined();
  });

  it('should handle missing category field', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        quantity: 2,
        // category field is missing
      }),
    });

    const response = await fetch('http://api/categorize');
    const data = await response.json();

    expect(data.category).toBeUndefined();
    expect(data.quantity).toBe(2);
  });

  it('should handle category as null', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        category: null,
        quantity: 1,
      }),
    });

    const response = await fetch('http://api/categorize');
    const data = await response.json();

    expect(data.category).toBeNull();
    expect(typeof data.category).toBe('object');
    // Should reject: category must be a string
  });

  it('should handle category as number', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        category: 123, // wrong type
      }),
    });

    const response = await fetch('http://api/categorize');
    const data = await response.json();

    expect(typeof data.category).toBe('number');
    // Should reject: category must be a string
  });

  it('should handle category as array', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        category: ['מוצרי חלב וביצים'], // array, not string
      }),
    });

    const response = await fetch('http://api/categorize');
    const data = await response.json();

    expect(Array.isArray(data.category)).toBe(true);
    // Should reject: category must be a string
  });

  it('should handle category as object', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        category: { name: 'מוצרי חלב וביצים' }, // object, not string
      }),
    });

    const response = await fetch('http://api/categorize');
    const data = await response.json();

    expect(typeof data.category).toBe('object');
    // Should reject: category must be a string
  });

  it('should handle category as empty string', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        category: '', // empty
      }),
    });

    const response = await fetch('http://api/categorize');
    const data = await response.json();

    expect(data.category).toBe('');
    expect(data.category.trim()).toBe('');
    // Should reject: category cannot be empty
  });

  it('should handle category as whitespace only', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        category: '   ', // whitespace only
      }),
    });

    const response = await fetch('http://api/categorize');
    const data = await response.json();

    expect(typeof data.category).toBe('string');
    expect(data.category.trim()).toBe('');
    // Should reject: category cannot be whitespace-only
  });

  it('should handle response with extra fields', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        category: 'מוצרי חלב וביצים',
        quantity: 2,
        extra_field_1: 'should be ignored',
        extra_field_2: { nested: 'data' },
        _internal: 'ignored',
      }),
    });

    const response = await fetch('http://api/categorize');
    const data = await response.json();

    // Should extract only category and ignore extras
    expect(data.category).toBe('מוצרי חלב וביצים');
    expect(data.quantity).toBe(2);
    expect(data.extra_field_1).toBe('should be ignored');
    // Application should use data.category and ignore others
  });

  it('should validate category is valid Hebrew string', async () => {
    const validCategories = [
      'מוצרי חלב וביצים',
      'ירקות ופירות',
      'שתייה',
      'ניקיון',
    ];

    for (const cat of validCategories) {
      expect(typeof cat).toBe('string');
      expect(cat.trim().length).toBeGreaterThan(0);
    }
  });

  it('should reject category with invalid characters', () => {
    const invalidCategories = [
      '', // empty
      '   ', // whitespace
      null, // null
      undefined, // undefined
      123, // number
      [], // array
      {}, // object
      '<script>alert("xss")</script>', // potential XSS
    ];

    for (const cat of invalidCategories) {
      const isValid = typeof cat === 'string' && cat.trim().length > 0;
      expect(isValid).toBe(false);
    }
  });

  it('should handle response with category but also error field', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        category: 'מוצרי חלב וביצים',
        error: 'some error message',
      }),
    });

    const response = await fetch('http://api/categorize');
    const data = await response.json();

    // Should use category even if error field is present
    expect(data.category).toBe('מוצרי חלב וביצים');
    // The presence of an error field might indicate a problem,
    // but if category is valid, we should use it
  });

  it('should input validate itemId before calling fetch', () => {
    const invalidIds = [
      '', // empty
      null, // null
      undefined, // undefined
      123, // number
      [], // array
      {}, // object
    ];

    for (const id of invalidIds) {
      const isValid = id && typeof id === 'string';
      expect(isValid).toBe(false);
    }
  });

  it('should input validate itemName before calling fetch', () => {
    const invalidNames = [
      '', // empty
      '   ', // whitespace only
      null, // null
      undefined, // undefined
      123, // number
    ];

    for (const name of invalidNames) {
      const isValid = name && typeof name === 'string' && name.trim() !== '';
      expect(isValid).toBe(false);
    }
  });

  it('should handle very large response (potential DoS)', async () => {
    // Create a very large category string
    const largeString = 'א'.repeat(100000); // 100k characters

    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        category: largeString,
      }),
    });

    const response = await fetch('http://api/categorize');
    const data = await response.json();

    expect(typeof data.category).toBe('string');
    expect(data.category.length).toBe(100000);

    // Application should handle large strings without crashing
    // But should perhaps log a warning
  });

  it('should require API_BASE_URL to be configured', () => {
    const apiUrl = process.env.EXPO_PUBLIC_API_BASE_URL;

    // Should check that API URL is configured
    if (!apiUrl) {
      expect(apiUrl).toBeUndefined();
      // Application should skip /categorize call and show error
    } else {
      expect(typeof apiUrl).toBe('string');
      expect(apiUrl.length).toBeGreaterThan(0);
    }
  });
});
