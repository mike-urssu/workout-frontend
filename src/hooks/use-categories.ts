import { useEffect, useState } from 'react';

import { Category, getCategories } from '@/api/workout';
import { GROUPS } from '@/data/catalog';

let cache: Category[] | null = null; // reference data: fetched once per app run (design 4.2 WO-001)

/** Colour / photo for a body part; the server only sends the name and a remote image path. */
export const styleOf = (name: string) => GROUPS.find((g) => g.name === name);

export function useCategories() {
  const [categories, setCategories] = useState<Category[]>(cache ?? []);
  useEffect(() => {
    if (cache) return;
    getCategories().then((c) => { cache = c; setCategories(c); }).catch(() => {});
  }, []);
  return categories;
}
