import { supabase } from '../lib/supabase';

interface CorrectCategoryArgs {
  itemId: string;
  itemName: string;
  newCategory: string;
}

export function useCorrectCategory() {
  const correctCategory = async ({ itemId, itemName, newCategory }: CorrectCategoryArgs) => {
    let backendOk = false;
    try {
      const apiUrl = `${process.env.EXPO_PUBLIC_API_BASE_URL}/categorize/override`;
      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ item_name: itemName, category: newCategory }),
      });
      backendOk = res.ok;
      if (!res.ok) {
        console.error('Backend rejected override:', res.status);
      }
    } catch (e) {
      console.error('Failed to post override to backend:', e);
    }

    if (!backendOk) return;

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
