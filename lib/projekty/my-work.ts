import { getDueStatus, startOfLocalDay } from "./due-date";
import { comparePriority, type CardPriorityValue } from "./priority";

/**
 * Sjednocení dvou dosud oddělených světů — karty z boardů a osobní To-Do —
 * do jednoho seznamu stránky „Moje práce". Čistá logika bez Prisma i Reactu,
 * aby šla celá otestovat.
 */

export type WorkItemKind = "card" | "todo";

export type WorkItem = {
  kind: WorkItemKind;
  id: string;
  title: string;
  due: Date | null;
  completed: boolean;
  priority: CardPriorityValue | null;
  /** Přiřazeno nedávno → odznak „Nové". Osobní úkoly ho nemají (zadal si je uživatel sám). */
  isNew: boolean;
  /** Kam položka patří: „Board · Sloupec", u osobního úkolu null. */
  context: string | null;
  /** Cíl odkazu u karty; osobní úkol se otevírá v sheetu. */
  href: string | null;
};

export type WorkSectionKey = "overdue" | "today" | "week" | "later" | "noDue";

export type WorkSection = {
  key: WorkSectionKey;
  label: string;
  items: WorkItem[];
};

const SECTION_LABELS: Record<WorkSectionKey, string> = {
  overdue: "Po termínu",
  today: "Dnes",
  week: "Tento týden",
  later: "Později",
  noDue: "Bez termínu",
};

const SECTION_ORDER: WorkSectionKey[] = ["overdue", "today", "week", "later", "noDue"];

/** Přiřazení mladší než tohle se na stránce označí jako „Nové". */
export const NEW_ASSIGNMENT_DAYS = 7;

export function isRecentlyAssigned(
  assignedAt: Date | string | null | undefined,
  now: Date = new Date(),
): boolean {
  if (!assignedAt) return false;
  const assigned = new Date(assignedAt);
  if (Number.isNaN(assigned.getTime())) return false;
  const cutoff = new Date(now.getTime() - NEW_ASSIGNMENT_DAYS * 24 * 60 * 60 * 1000);
  return assigned.getTime() >= cutoff.getTime();
}

/**
 * Do které sekce položka patří. Buckety jsou exkluzivní a čistě termínové —
 * priorita řadí až uvnitř sekce (viz sortItems).
 *
 * Na rozdíl od badge se tady completed neignoruje: dokončená karta po termínu
 * už nehoří, ale ve výpisu „Hotovo" má zůstat u svého data, proto se stav
 * počítá z data a completed se řeší filtrem sekce výše.
 */
export function sectionForDue(due: Date | null, now: Date = new Date()): WorkSectionKey {
  if (!due) return "noDue";
  const status = getDueStatus(due, false);
  if (status === "overdue") return "overdue";
  if (status === "today") return "today";

  // „Tento týden" = následujících 7 kalendářních dnů od zítřka včetně.
  const today = startOfLocalDay(now);
  const weekEnd = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 7);
  const dueDay = startOfLocalDay(new Date(due));
  return dueDay.getTime() < weekEnd.getTime() ? "week" : "later";
}

/** Uvnitř sekce: priorita → termín → název (stabilní, bez závislosti na pořadí z DB). */
export function sortItems(items: WorkItem[]): WorkItem[] {
  return [...items].sort((a, b) => {
    const byPriority = comparePriority(a.priority, b.priority);
    if (byPriority !== 0) return byPriority;

    if (a.due && b.due) {
      const byDue = a.due.getTime() - b.due.getTime();
      if (byDue !== 0) return byDue;
    } else if (a.due) return -1;
    else if (b.due) return 1;

    return a.title.localeCompare(b.title, "cs");
  });
}

/** Sekce v pevném pořadí naléhavosti; prázdné se vynechávají. */
export function buildWorkSections(items: WorkItem[], now: Date = new Date()): WorkSection[] {
  const buckets = new Map<WorkSectionKey, WorkItem[]>();
  for (const item of items) {
    const key = sectionForDue(item.due, now);
    const bucket = buckets.get(key);
    if (bucket) bucket.push(item);
    else buckets.set(key, [item]);
  }

  return SECTION_ORDER.flatMap((key) => {
    const bucket = buckets.get(key);
    if (!bucket || bucket.length === 0) return [];
    return [{ key, label: SECTION_LABELS[key], items: sortItems(bucket) }];
  });
}
