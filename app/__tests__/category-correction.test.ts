/**
 * Category Correction Audit
 *
 * Verifies that useCorrectCategory (or equivalent) correctly:
 * 1. Normalizes the item name before writing (using the shared normalize utility).
 * 2. Upserts the manual_overrides table with item_name_normalized, category, last_corrected_at.
 * 3. Updates the corresponding grocery_items row so the list shows the new category.
 *
 * These tests use mocks for Supabase — we verify the correct calls are made,
 * not that Supabase itself works (that's an integration/E2E concern).
 */

// Mock Supabase client
const mockUpsert = jest.fn().mockResolvedValue({ error: null });
const mockUpdate = jest.fn().mockResolvedValue({ error: null });
const mockEq = jest.fn().mockReturnValue({ eq: jest.fn().mockResolvedValue({ error: null }) });

jest.mock('../lib/supabase', () => ({
  supabase: {
    from: jest.fn((table: string) => {
      if (table === 'manual_overrides') {
        return { upsert: mockUpsert };
      }
      if (table === 'grocery_items') {
        return { update: mockUpdate.mockReturnValue({ eq: mockEq }) };
      }
      return {};
    }),
  },
}));

jest.mock('../utils/normalize', () => ({
  normalize: jest.fn((s: string) => s.trim().replace(/\s+/g, ' ')),
}));

import { normalize } from '../utils/normalize';
import { useCorrectCategory } from '../hooks/useCorrectCategory';

describe('Category Correction Flow', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('calls normalize on the item name before writing to manual_overrides', async () => {
    const { correctCategory } = useCorrectCategory();
    await correctCategory({ itemId: '123', itemName: '  חלב  ', newCategory: 'מוצרי חלב וביצים' });
    expect(normalize).toHaveBeenCalledWith('  חלב  ');
  });

  it('upserts manual_overrides with normalized name, category, and timestamp', async () => {
    const { correctCategory } = useCorrectCategory();
    await correctCategory({ itemId: '123', itemName: '  חלב  ', newCategory: 'מוצרי חלב וביצים' });
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        item_name_normalized: 'חלב',
        category: 'מוצרי חלב וביצים',
        last_corrected_at: expect.any(String),
      }),
      expect.objectContaining({ onConflict: 'item_name_normalized' })
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

  it('handles Supabase upsert error gracefully', async () => {
    mockUpsert.mockResolvedValueOnce({ error: { message: 'conflict' } });
    const { correctCategory } = useCorrectCategory();
    await expect(
      correctCategory({ itemId: '123', itemName: 'חלב', newCategory: 'מוצרי חלב וביצים' })
    ).resolves.not.toThrow();
  });
});
