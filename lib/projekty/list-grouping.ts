import type { CardData } from "@/components/projekty/boards/CardItem";
import type { ListData } from "@/components/projekty/boards/BoardListColumn";
import type { BoardGroupBy } from "./board-view";
import { findListColor } from "./list-colors";
import { getDueStatus, type DueStatus } from "./due-date";

export type CardGroup = {
  key: string;
  label: string;
  /** CSS barva tečky v hlavičce skupiny (null = bez tečky). */
  dotColor: string | null;
  /** Cílový list pro drop — jen při group=list; jinak null (drag disabled). */
  droppableListId: string | null;
  cards: CardData[];
};

export type MemberLite = { id: number; name: string | null; email: string | null };

const DUE_BUCKETS: { status: DueStatus; label: string; dotColor: string | null }[] = [
  { status: "overdue", label: "Po termínu", dotColor: "hsl(0 72% 51%)" },
  { status: "today", label: "Dnes", dotColor: "hsl(38 92% 50%)" },
  { status: "upcoming", label: "Nadcházející", dotColor: "hsl(217 91% 60%)" },
  { status: "none", label: "Bez termínu", dotColor: null },
];

/**
 * Skupiny pro list view. `list` je 1:1 se sloupci (drag povolen); `due` a
 * `assignee` jsou projekce (drag disabled — přesun mezi buckety by měnil
 * termín/přiřazení, to je chování vlny 5). Prázdné skupiny se vynechávají.
 */
export function buildGroups(
  groupBy: BoardGroupBy,
  displayedLists: ListData[],
  allMembers: MemberLite[],
): CardGroup[] {
  if (groupBy === "list") {
    return displayedLists.map((l) => ({
      key: l.id,
      label: l.name,
      dotColor: findListColor(l.color).dot,
      droppableListId: l.id,
      cards: l.cards,
    }));
  }

  const allCards = displayedLists.flatMap((l) => l.cards);

  if (groupBy === "due") {
    return DUE_BUCKETS.map((bucket) => ({
      key: `due-${bucket.status}`,
      label: bucket.label,
      dotColor: bucket.dotColor,
      droppableListId: null,
      // Badge sémantika (completed → none) by hotové karty vytrhla z bucketů
      // termínu — pro grouping se completed ignoruje (kalendářní projekce).
      cards: allCards.filter((c) => getDueStatus(c.dueDate, false) === bucket.status),
    })).filter((g) => g.cards.length > 0);
  }

  // assignee — podle prvního člena karty (pořadí dle allMembers), Nepřiřazeno na konec
  const byFirstMember = new Map<number, CardData[]>();
  const unassigned: CardData[] = [];
  for (const card of allCards) {
    const first = card.members[0];
    if (!first) {
      unassigned.push(card);
      continue;
    }
    byFirstMember.set(first.userId, [...(byFirstMember.get(first.userId) ?? []), card]);
  }
  const groups: CardGroup[] = [];
  for (const member of allMembers) {
    const cards = byFirstMember.get(member.id);
    if (!cards || cards.length === 0) continue;
    groups.push({
      key: `assignee-${member.id}`,
      label: member.name || member.email || `Uživatel ${member.id}`,
      dotColor: null,
      droppableListId: null,
      cards,
    });
    byFirstMember.delete(member.id);
  }
  // Členové karty mimo allMembers (např. odebraný z boardu) — nezahodit
  for (const [userId, cards] of byFirstMember) {
    const user = cards[0]?.members[0]?.user;
    groups.push({
      key: `assignee-${userId}`,
      label: user?.name || user?.email || `Uživatel ${userId}`,
      dotColor: null,
      droppableListId: null,
      cards,
    });
  }
  if (unassigned.length > 0) {
    groups.push({
      key: "assignee-none",
      label: "Nepřiřazeno",
      dotColor: null,
      droppableListId: null,
      cards: unassigned,
    });
  }
  return groups;
}
