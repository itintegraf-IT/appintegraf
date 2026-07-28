export type MaterialNavItem = {
  id: number;
  title: string;
  categoryId: number | null;
  categoryName: string | null;
};

/** Seřadí materiály podle okruhu a názvu. */
export function sortMaterials(items: MaterialNavItem[]): MaterialNavItem[] {
  return [...items].sort((a, b) => {
    const catA = a.categoryName ?? "zzz";
    const catB = b.categoryName ?? "zzz";
    const byCat = catA.localeCompare(catB, "cs");
    if (byCat !== 0) return byCat;
    return a.title.localeCompare(b.title, "cs");
  });
}

/** Vrátí materiály filtrované podle okruhu (null = vše). */
export function filterMaterialsByCategory(
  items: MaterialNavItem[],
  categoryId: number | null
): MaterialNavItem[] {
  if (categoryId === null) return sortMaterials(items);
  return sortMaterials(items.filter((m) => m.categoryId === categoryId));
}

export type MaterialNavPosition = {
  index: number;
  total: number;
  prevId: number | null;
  nextId: number | null;
};

export function getMaterialNavPosition(
  items: MaterialNavItem[],
  currentId: number
): MaterialNavPosition {
  const index = items.findIndex((m) => m.id === currentId);
  if (index < 0) {
    return { index: -1, total: items.length, prevId: null, nextId: null };
  }
  return {
    index,
    total: items.length,
    prevId: index > 0 ? items[index - 1].id : null,
    nextId: index < items.length - 1 ? items[index + 1].id : null,
  };
}
