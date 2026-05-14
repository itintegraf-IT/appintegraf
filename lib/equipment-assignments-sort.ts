export type AssignmentSortKey = "jmeno" | "nazev" | "skupina" | "predano";
export type AssignmentSortDir = "asc" | "desc";
export type AssignmentView = "table" | "cards";

type SortableUser = {
  first_name: string;
  last_name: string;
} | null;

type SortableEquipment = {
  name: string;
  equipment_categories?: { name: string } | null;
};

type SortableRow = {
  assigned_at: Date;
  users_equipment_assignments_user_idTousers: SortableUser;
  equipment_items: SortableEquipment;
};

function userLabel(u: SortableUser): string {
  if (!u) return "—";
  return `${u.last_name} ${u.first_name}`.trim() || "—";
}

function categoryLabel(e: SortableEquipment): string {
  return e.equipment_categories?.name?.trim() || "—";
}

export function parseAssignmentSort(sort?: string): AssignmentSortKey {
  if (sort === "jmeno" || sort === "nazev" || sort === "skupina" || sort === "predano") {
    return sort;
  }
  return "predano";
}

export function parseAssignmentDir(dir?: string, sort: AssignmentSortKey = "predano"): AssignmentSortDir {
  if (dir === "asc" || dir === "desc") return dir;
  return sort === "predano" ? "desc" : "asc";
}

export function parseAssignmentView(view: string | undefined, seeAll: boolean): AssignmentView {
  if (!seeAll) return "table";
  return view === "cards" ? "cards" : "table";
}

export function sortAssignmentRows<T extends SortableRow>(
  rows: T[],
  sort: AssignmentSortKey,
  dir: AssignmentSortDir
): T[] {
  const mul = dir === "desc" ? -1 : 1;
  const cmpStr = (a: string, b: string) => a.localeCompare(b, "cs", { sensitivity: "base" }) * mul;

  return [...rows].sort((a, b) => {
    switch (sort) {
      case "jmeno":
        return cmpStr(
          userLabel(a.users_equipment_assignments_user_idTousers),
          userLabel(b.users_equipment_assignments_user_idTousers)
        );
      case "nazev":
        return cmpStr(a.equipment_items.name, b.equipment_items.name);
      case "skupina":
        return cmpStr(categoryLabel(a.equipment_items), categoryLabel(b.equipment_items));
      case "predano":
      default:
        return (a.assigned_at.getTime() - b.assigned_at.getTime()) * mul;
    }
  });
}
