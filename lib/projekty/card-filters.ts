import { getDueStatus, startOfLocalDay } from "./due-date";
import { isCardPriority, type CardPriorityValue } from "./priority";

export type CardFilters = {
  q?: string;
  memberIds?: string[];
  labelIds?: string[];
  dueRange?: "overdue" | "today" | "week" | "none";
  completed?: "true" | "false" | "any";
  /** Prázdné/nepřítomné = bez filtru. "none" = karty bez priority. */
  priorities?: (CardPriorityValue | "none")[];
};

export function parseCardFilters(
  searchParams: URLSearchParams | { get(k: string): string | null },
): CardFilters {
  const get = (k: string) => searchParams.get(k);
  return {
    q: get("q") ?? undefined,
    memberIds: get("members")?.split(",").filter(Boolean),
    labelIds: get("labels")?.split(",").filter(Boolean),
    dueRange: (get("due") as CardFilters["dueRange"]) ?? undefined,
    completed: (get("completed") as CardFilters["completed"]) ?? "any",
    priorities: parsePriorityParam(get("priority")),
  };
}

/** Neznámé hodnoty z URL zahazujeme — jinak by filtr tiše nevrátil nic. */
function parsePriorityParam(raw: string | null): CardFilters["priorities"] {
  if (!raw) return undefined;
  const values = raw
    .split(",")
    .filter((v) => v === "none" || isCardPriority(v)) as (CardPriorityValue | "none")[];
  return values.length > 0 ? values : undefined;
}

export function serializeCardFilters(filters: CardFilters): URLSearchParams {
  const sp = new URLSearchParams();
  if (filters.q) sp.set("q", filters.q);
  if (filters.memberIds?.length) sp.set("members", filters.memberIds.join(","));
  if (filters.labelIds?.length) sp.set("labels", filters.labelIds.join(","));
  if (filters.dueRange) sp.set("due", filters.dueRange);
  if (filters.completed && filters.completed !== "any") {
    sp.set("completed", filters.completed);
  }
  if (filters.priorities?.length) sp.set("priority", filters.priorities.join(","));
  return sp;
}

export function matchesFilters(
  card: {
    title: string;
    completed: boolean;
    dueDate: Date | string | null;
    members: { userId: number }[];
    labels: { labelId: string }[];
    priority?: CardPriorityValue | null;
  },
  filters: CardFilters,
): boolean {
  if (filters.q && !card.title.toLowerCase().includes(filters.q.toLowerCase())) {
    return false;
  }
  if (filters.memberIds?.length) {
    const memberSet = new Set(card.members.map((m) => String(m.userId)));
    if (!filters.memberIds.some((id) => memberSet.has(id))) return false;
  }
  if (filters.labelIds?.length) {
    const labelSet = new Set(card.labels.map((l) => l.labelId));
    if (!filters.labelIds.some((id) => labelSet.has(id))) return false;
  }
  if (filters.completed === "true" && !card.completed) return false;
  if (filters.completed === "false" && card.completed) return false;
  if (filters.priorities?.length) {
    if (!filters.priorities.includes(card.priority ?? "none")) return false;
  }
  if (filters.dueRange) {
    if (filters.dueRange === "none") {
      if (card.dueDate) return false;
    } else {
      if (!card.dueDate) return false;
      const due = new Date(card.dueDate);
      const today = startOfLocalDay();
      const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);
      const weekFromNow = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);

      if (filters.dueRange === "overdue") {
        if (getDueStatus(due, card.completed) !== "overdue") return false;
      } else if (filters.dueRange === "today") {
        // Záměrně bez completed guardu — filtr „dnes" má ukázat i hotové (filtr ≠ badge).
        if (due < today || due >= tomorrow) return false;
      } else if (filters.dueRange === "week") {
        if (due < today || due >= weekFromNow) return false;
      }
    }
  }
  return true;
}
