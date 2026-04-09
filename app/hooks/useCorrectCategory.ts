import { supabase } from '../lib/supabase';

interface CorrectCategoryArgs {
  itemId: string;
  itemName: string;
  newCategory: string;
}

export function useCorrectCategory() {
  const correctCategory = async ({ itemId, itemName, newCategory }: CorrectCategoryArgs) => {
    // POST /categorize/override — validates category, updates Layer 0 (SQLite dict) + Layer 1 (manual_overrides)
    try {
      const apiUrl = `${process.env.EXPO_PUBLIC_API_BASE_URL}/categorize/override`;
      await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ item_name: itemName, category: newCategory }),
      });
    } catch (e) {
      console.error('Failed to post override to backend:', e);
    }

    // Update the displayed item in Supabase regardless of backend result
    const { error: updateError } = await supabase
      .from('grocery_items')
      .update({ category: newCategory })
      .eq('id', itemId);

    if (updateError) {
      console.error('Failed to update grocery_items:', updateError);
    }
  };

  return { correctCategory };
}
