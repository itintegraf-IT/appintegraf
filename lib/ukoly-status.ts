export type UkolStatus = "open" | "in_progress" | "done" | "cancelled";

export function ukolStatusLabel(status: string): string {
  switch (status) {
    case "open":
      return "Nový";
    case "in_progress":
      return "Rozpracovaný";
    case "done":
      return "Hotovo";
    case "cancelled":
      return "Zrušený";
    default:
      return status;
  }
}

export function ukolStatusBadgeClass(status: string): string {
  switch (status) {
    case "done":
      return "bg-green-100 text-green-800";
    case "in_progress":
      return "bg-blue-100 text-blue-800";
    case "cancelled":
      return "bg-gray-200 text-gray-700";
    case "open":
      return "bg-amber-100 text-amber-800";
    default:
      return "bg-gray-100 text-gray-700";
  }
}
