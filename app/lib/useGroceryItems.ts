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
  optimisticInsert: (item: GroceryItem) => void;
  optimisticDelete: (id: string) => void;
  optimisticUpdate: (id: string, changes: Partial<GroceryItem>) => void;
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

  const optimisticInsert = useCallback((item: GroceryItem) => {
    setItems((prev) => [...prev, item]);
  }, []);

  const optimisticDelete = useCallback((id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const optimisticUpdate = useCallback(
    (id: string, changes: Partial<GroceryItem>) => {
      setItems((prev) =>
        prev.map((item) => (item.id === id ? { ...item, ...changes } : item))
      );
    },
    []
  );

  useEffect(() => {
    let isMounted = true;
    let isInitialized = false;

    const initializeAndSubscribe = async () => {
      // Initial fetch first
      await fetchItems();
      if (!isMounted) return;
      isInitialized = true;

      // Then set up subscription
      const channel = supabase
        .channel("grocery_items_changes")
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "grocery_items" },
          (payload) => {
            if (!isInitialized) return;
            const incoming = payload.new as GroceryItem;
            setItems((prev) => {
              // Prevent duplicates: only add if not already present
              const exists = prev.some((i) => i.id === incoming.id);
              return exists ? prev : [...prev, incoming];
            });
          }
        )
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "grocery_items" },
          (payload) => {
            if (!isInitialized) return;
            const updated = payload.new as GroceryItem;
            setItems((prev) =>
              prev.map((item) =>
                item.id === updated.id ? updated : item
              )
            );
          }
        )
        .on(
          "postgres_changes",
          { event: "DELETE", schema: "public", table: "grocery_items" },
          (payload) => {
            if (!isInitialized) return;
            const deleted = payload.old as GroceryItem;
            setItems((prev) =>
              prev.filter((item) => item.id !== deleted.id)
            );
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    };

    initializeAndSubscribe();

    return () => {
      isMounted = false;
    };
  }, [fetchItems]);

  return { items, loading, error, optimisticInsert, optimisticDelete, optimisticUpdate };
}
