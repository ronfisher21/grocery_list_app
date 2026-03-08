import { useEffect, useState, useCallback } from "react";
import { supabase } from "./supabase";

export interface GroceryItem {
  id: string;
  item_name: string;
  category: string;
  checked: boolean;
  created_at: string;
}

interface UseGroceryItemsResult {
  items: GroceryItem[];
  loading: boolean;
  error: string | null;
}

export function useGroceryItems(): UseGroceryItemsResult {
  const [items, setItems] = useState<GroceryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    const { data, error: fetchError } = await supabase
      .from("grocery_items")
      .select("*")
      .order("created_at", { ascending: true });

    if (fetchError) {
      setError(fetchError.message);
    } else {
      setItems(data as GroceryItem[]);
      setError(null);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchItems();

    const channel = supabase
      .channel("grocery_items_changes")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "grocery_items" },
        (payload) => {
          setItems((prev) => [...prev, payload.new as GroceryItem]);
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "grocery_items" },
        (payload) => {
          setItems((prev) =>
            prev.map((item) =>
              item.id === (payload.new as GroceryItem).id
                ? (payload.new as GroceryItem)
                : item
            )
          );
        }
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "grocery_items" },
        (payload) => {
          setItems((prev) =>
            prev.filter((item) => item.id !== (payload.old as GroceryItem).id)
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchItems]);

  return { items, loading, error };
}
