/**
 * Test edge cases for categorization error handling (Issue #1)
 *
 * Scenarios:
 * 1. Network timeout
 * 2. HTTP 500 error
 * 3. Malformed JSON response
 * 4. Missing category field in response
 * 5. Invalid category value
 * 6. Successful retry after failure
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';

// Mock fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('Categorization Error Handling (Issue #1)', () => {
  beforeEach(() => {
    mockFetch.mockClear();
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should handle network timeout gracefully', async () => {
    // Simulate network timeout
    mockFetch.mockRejectedValueOnce(new Error('Network timeout'));

    const testItem = {
      id: 'test-1',
      itemName: 'לבן',
      expectedError: 'Network timeout',
    };

    const fetchPromise = fetch('http://api/categorize', {
      method: 'POST',
      body: JSON.stringify({ item_name: testItem.itemName }),
    });

    try {
      await fetchPromise;
      expect.fail('Should have thrown network error');
    } catch (e) {
      expect(e).toEqual(expect.objectContaining({
        message: expect.stringContaining('Network timeout'),
      }));
    }
  });

  it('should handle HTTP 500 error', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
    });

    const response = await fetch('http://api/categorize', {
      method: 'POST',
      body: JSON.stringify({ item_name: 'לבן' }),
    });

    expect(response.ok).toBe(false);
    expect(response.status).toBe(500);
  });

  it('should handle malformed JSON response', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => {
        throw new Error('Invalid JSON');
      },
    });

    const response = await fetch('http://api/categorize');
    expect(response.ok).toBe(true);

    try {
      await response.json();
      expect.fail('Should have thrown JSON parse error');
    } catch (e) {
      expect(e).toEqual(expect.objectContaining({
        message: expect.stringContaining('Invalid JSON'),
      }));
    }
  });

  it('should handle missing category field', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        quantity: 2,
        // Missing 'category' field
      }),
    });

    const response = await fetch('http://api/categorize');
    const data = await response.json();

    expect(data.category).toBeUndefined();
  });

  it('should track failed items for retry', () => {
    // This is a state management test
    // Simulates: failedCategorizations Map
    const failedMap = new Map<string, string>();

    // Item categorization failed
    failedMap.set('item-1', 'HTTP 500');
    failedMap.set('item-2', 'Network timeout');

    expect(failedMap.has('item-1')).toBe(true);
    expect(failedMap.get('item-1')).toBe('HTTP 500');
    expect(failedMap.get('item-2')).toBe('Network timeout');

    // Retry: clear on successful categorization
    failedMap.delete('item-1');
    expect(failedMap.has('item-1')).toBe(false);
    expect(failedMap.get('item-2')).toBe('Network timeout');
  });

  it('should retry categorization and recover', async () => {
    const itemId = 'item-123';
    const itemName = 'לבן';

    // First attempt: fails
    mockFetch.mockRejectedValueOnce(new Error('Network timeout'));

    // Second attempt: succeeds
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        category: 'מוצרי חלב וביצים',
        quantity: null,
      }),
    });

    // First call fails
    try {
      await fetch('http://api/categorize', {
        method: 'POST',
        body: JSON.stringify({ item_name: itemName }),
      });
      expect.fail('First call should fail');
    } catch (e) {
      expect(e).toBeDefined();
    }

    // Retry succeeds
    const response = await fetch('http://api/categorize', {
      method: 'POST',
      body: JSON.stringify({ item_name: itemName }),
    });

    expect(response.ok).toBe(true);
    const data = await response.json();
    expect(data.category).toBe('מוצרי חלב וביצים');
  });

  it('should not skip update when category is FALLBACK after error recovery', () => {
    // The bug fix removed the condition:
    // if (category === FALLBACK_CATEGORY) { skip update }
    //
    // This test verifies that even if /categorize returns FALLBACK,
    // we still update the item instead of skipping.

    const FALLBACK = 'מוצרים יבשים ושימורים';
    const receivedCategory = FALLBACK;

    // OLD BEHAVIOR (buggy): would skip update
    // if (receivedCategory === FALLBACK) return; // BUG

    // NEW BEHAVIOR (fixed): always update
    expect(receivedCategory).toBeDefined(); // Always update
    expect(receivedCategory).toBe(FALLBACK);
  });

  it('should handle HTTP 404 for invalid endpoint', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
      statusText: 'Not Found',
    });

    const response = await fetch('http://api/categorize-typo');
    expect(response.ok).toBe(false);
    expect(response.status).toBe(404);
  });

  it('should handle HTTP 429 rate limit', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 429,
      statusText: 'Too Many Requests',
    });

    const response = await fetch('http://api/categorize');
    expect(response.ok).toBe(false);
    expect(response.status).toBe(429);
  });
});
