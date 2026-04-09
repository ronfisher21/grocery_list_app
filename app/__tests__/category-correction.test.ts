/**
 * Category Correction Audit
 *
 * Verifies that useCorrectCategory correctly:
 * 1. POSTs to the backend /categorize/override endpoint (which handles normalize + manual_overrides).
 * 2. Updates the grocery_items row in Supabase so the list reflects the new category immediately.
 * 3. Continues gracefully if the backend call fails (Supabase update still runs).
 */

// Mock fetch
const mockFetch = jest.fn().mockResolvedValue({ ok: true });
global.fetch = mockFetch;

// Mock Supabase client — chain: from().update().eq()
const mockEq = jest.fn().mockResolvedValue({ error: null });
const mockUpdate = jest.fn().mockReturnValue({ eq: mockEq });

jest.mock('../lib/supabase', () => ({
  supabase: {
    from: jest.fn((table: string) => {
      if (table === 'grocery_items') {
        return { update: mockUpdate };
      }
      return {};
    }),
  },
}));

import { useCorrectCategory } from '../hooks/useCorrectCategory';

describe('Category Correction Flow', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetch.mockResolvedValue({ ok: true });
    process.env.EXPO_PUBLIC_API_BASE_URL = 'http://localhost:8000';
  });

  it('POSTs item_name and category to /categorize/override', async () => {
    const { correctCategory } = useCorrectCategory();
    await correctCategory({ itemId: '123', itemName: 'חלב', newCategory: 'מוצרי חלב וביצים' });
    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:8000/categorize/override',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ item_name: 'חלב', category: 'מוצרי חלב וביצים' }),
      })
    );
  });

  it('updates grocery_items row with the new category', async () => {
    const { correctCategory } = useCorrectCategory();
    await correctCategory({ itemId: '123', itemName: 'חלב', newCategory: 'מוצרי חלב וביצים' });
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ category: 'מוצרי חלב וביצים' })
    );
    expect(mockEq).toHaveBeenCalledWith('id', '123');
  });

  it('still updates grocery_items even if backend call throws', async () => {
    mockFetch.mockRejectedValueOnce(new Error('network error'));
    const { correctCategory } = useCorrectCategory();
    await correctCategory({ itemId: '123', itemName: 'חלב', newCategory: 'מוצרי חלב וביצים' });
    expect(mockUpdate).toHaveBeenCalled();
  });

  it('does not throw when Supabase update returns an error', async () => {
    mockEq.mockResolvedValueOnce({ error: { message: 'db error' } });
    const { correctCategory } = useCorrectCategory();
    await expect(
      correctCategory({ itemId: '123', itemName: 'חלב', newCategory: 'מוצרי חלב וביצים' })
    ).resolves.not.toThrow();
  });
});
