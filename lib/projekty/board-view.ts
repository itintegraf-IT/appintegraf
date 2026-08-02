export type BoardViewType = "kanban" | "list" | "calendar";

const VALID_VIEWS: readonly BoardViewType[] = ["kanban", "list", "calendar"] as const;

export function parseBoardView(
  searchParams: URLSearchParams | { get(k: string): string | null },
): BoardViewType {
  const raw = searchParams.get("view");
  if (raw && VALID_VIEWS.includes(raw as BoardViewType)) {
    return raw as BoardViewType;
  }
  return "kanban";
}

export type BoardGroupBy = "list" | "assignee" | "due" | "priority";

const VALID_GROUPS: readonly BoardGroupBy[] = ["list", "assignee", "due", "priority"] as const;

/** ?group= pro list view — whitelist, default seskupení podle sloupce. */
export function parseBoardGroup(
  searchParams: URLSearchParams | { get(k: string): string | null },
): BoardGroupBy {
  const raw = searchParams.get("group");
  if (raw && VALID_GROUPS.includes(raw as BoardGroupBy)) {
    return raw as BoardGroupBy;
  }
  return "list";
}

/**
 * Year/month parsed from ?month=YYYY-MM. Defaults to current month
 * (Europe/Prague) when missing or invalid.
 */
export function parseCalendarMonth(
  searchParams: URLSearchParams | { get(k: string): string | null },
): { year: number; month: number } {
  const raw = searchParams.get("month");
  const now = new Date();
  const fallback = { year: now.getFullYear(), month: now.getMonth() + 1 };

  if (!raw) return fallback;
  const match = /^(\d{4})-(\d{2})$/.exec(raw);
  if (!match) return fallback;

  const year = Number(match[1]);
  const month = Number(match[2]);
  if (Number.isNaN(year) || Number.isNaN(month)) return fallback;
  if (month < 1 || month > 12) return fallback;

  return { year, month };
}

export function formatCalendarMonth(input: { year: number; month: number }): string {
  const mm = String(input.month).padStart(2, "0");
  return `${input.year}-${mm}`;
}
