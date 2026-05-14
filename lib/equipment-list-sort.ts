export type EquipmentListSortKey = "zapis" | "nazev" | "znacka" | "kategorie" | "uzivatel";
export type EquipmentListSortDir = "asc" | "desc";
export type EquipmentListView = "table" | "cards";

export type SortableEquipmentRow = {
  id: number;
  name: string;
  brand: string | null;
  model: string | null;
  equipment_categories?: { name: string } | null;
  assigned_to_name?: string | null;
};

function brandModelLabel(e: SortableEquipmentRow): string {
  return [e.brand, e.model].filter(Boolean).join(" / ") || "—";
}

function categoryLabel(e: SortableEquipmentRow): string {
  return e.equipment_categories?.name?.trim() || "—";
}

function userLabel(e: SortableEquipmentRow): string {
  return e.assigned_to_name?.trim() || "—";
}

export function parseEquipmentListSort(sort?: string): EquipmentListSortKey {
  if (sort === "nazev" || sort === "znacka" || sort === "kategorie" || sort === "uzivatel" || sort === "zapis") {
    return sort;
  }
  return "zapis";
}

export function parseEquipmentListDir(dir?: string, sort: EquipmentListSortKey = "zapis"): EquipmentListSortDir {
  if (dir === "asc" || dir === "desc") return dir;
  return sort === "zapis" ? "desc" : "asc";
}

export function parseEquipmentListView(view: string | undefined): EquipmentListView {
  return view === "cards" ? "cards" : "table";
}

export function sortEquipmentRows<T extends SortableEquipmentRow>(
  rows: T[],
  sort: EquipmentListSortKey,
  dir: EquipmentListSortDir
): T[] {
  const mul = dir === "desc" ? -1 : 1;
  const cmpStr = (a: string, b: string) => a.localeCompare(b, "cs", { sensitivity: "base" }) * mul;

  return [...rows].sort((a, b) => {
    switch (sort) {
      case "nazev":
        return cmpStr(a.name, b.name);
      case "znacka":
        return cmpStr(brandModelLabel(a), brandModelLabel(b));
      case "kategorie":
        return cmpStr(categoryLabel(a), categoryLabel(b));
      case "uzivatel":
        return cmpStr(userLabel(a), userLabel(b));
      case "zapis":
      default:
        return (a.id - b.id) * mul;
    }
  });
}
