import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import { Category, getCategories } from '@/api/workout';
import { GROUPS } from '@/data/catalog';

let cache: Category[] | null = null; // fetched once per app run (design 4.2 WO-001), refetched after the exercise list changes

/** Colour / photo for a body part; the server only sends the name and a remote image path. */
export const styleOf = (name: string) => GROUPS.find((g) => g.name === name);

/** Cached after the first call (reference data). */
export async function loadCategories() {
  cache ??= await getCategories();
  return cache;
}

/** Exercise counts changed (exercise added / moved / deleted): refetch on the next focus. */
export const invalidateCategories = () => {
  cache = null;
};

export function useCategories() {
  const [categories, setCategories] = useState<Category[]>(cache ?? []);
  useFocusEffect(
    useCallback(() => {
      loadCategories().then(setCategories).catch(() => {});
    }, []),
  );
  return categories;
}
