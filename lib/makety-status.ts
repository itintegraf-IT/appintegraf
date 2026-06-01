export type MaketaStatus = "open" | "in_progress" | "done" | "cancelled";

export type MaketaPriority = "normal" | "high" | "urgent";

export function maketaStatusLabel(status: string): string {
  switch (status) {
    case "open":
      return "Nová";
    case "in_progress":
      return "Ve výrobě";
    case "done":
      return "Hotovo";
    case "cancelled":
      return "Zrušená";
    default:
      return status;
  }
}

export function maketaStatusBadgeClass(status: string): string {
  switch (status) {
    case "done":
      return "bg-green-100 text-green-800";
    case "in_progress":
      return "bg-violet-100 text-violet-800";
    case "cancelled":
      return "bg-gray-200 text-gray-700";
    case "open":
      return "bg-amber-100 text-amber-800";
    default:
      return "bg-gray-100 text-gray-700";
  }
}

export function maketaPriorityLabel(priority: string): string {
  switch (priority) {
    case "urgent":
      return "Urgentní";
    case "high":
      return "Vysoká";
    case "normal":
    default:
      return "Normální";
  }
}

export function maketaPriorityBadgeClass(priority: string): string {
  switch (priority) {
    case "urgent":
      return "bg-red-100 text-red-800";
    case "high":
      return "bg-orange-100 text-orange-800";
    default:
      return "bg-gray-100 text-gray-700";
  }
}

export function parseMaketaPriority(raw: string | null | undefined): MaketaPriority {
  const p = (raw ?? "normal").toLowerCase();
  if (p === "urgent" || p === "high") return p;
  return "normal";
}
