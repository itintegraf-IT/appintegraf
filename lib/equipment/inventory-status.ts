/** České popisky stavů inventury — interní kódy se uživateli nikdy nezobrazují syrově. */

export type StatusTone = "success" | "warning" | "danger" | "neutral";

export const INVENTORY_STATUS_LABELS: Record<string, string> = {
  in_progress: "Probíhá",
  completed: "Uzavřena",
  draft: "Koncept",
};

export const INVENTORY_SCOPE_LABELS: Record<string, string> = {
  all: "Celá firma",
  room: "Místnost",
  category: "Skupina",
};

export function inventoryLineLabel(status: string, inventoryCompleted: boolean): { label: string; tone: StatusTone } {
  switch (status) {
    case "missing":
      return inventoryCompleted ? { label: "Chybí", tone: "danger" } : { label: "Čeká na sken", tone: "neutral" };
    case "found":
      return { label: "Nalezeno", tone: "success" };
    case "unexpected":
      return { label: "Nalezeno, evidováno jinde", tone: "warning" };
    case "extra":
      return { label: "Navíc (není v seznamu)", tone: "warning" };
    default:
      return { label: "Neznámý stav", tone: "neutral" };
  }
}
