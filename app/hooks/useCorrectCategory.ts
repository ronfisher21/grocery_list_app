import { supabase } from '../lib/supabase';
import { normalize } from '../utils/normalize';

interface CorrectCategoryArgs {
  itemId: string;
  itemName: string;
  newCategory: string;
}

export function useCorrectCategory() {
  const correctCategory = async ({ itemId, itemName, newCategory }: CorrectCategoryArgs) => {
    const itemNameNormalized = normalize(itemName);

    const { error: overrideError } = await supabase
      .from('manual_overrides')
      .upsert(
        {
          item_name_normalized: itemNameNormalized,
          category: newCategory,
          last_corrected_at: new Date().toISOString(),
        },
        { onConflict: 'item_name_normalized' }
      );

    if (overrideError) {
      console.error('Failed to upsert manual_overrides:', overrideError);
    }

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
