/**
 * Příprava dat: držitelé podle „Pracovník: …“ v poznámce (z importu staré evidence).
 * Čistá logika bez DB. Pracoviště („tiskárna“, „sklad“) ani nejednoznačná jména
 * se nikdy nepřiřadí; shoda jen podle příjmení je návrh k potvrzení.
 */

import { EQUIPMENT_ITEM_STATUS } from "@/lib/equipment-status";
import { normalizeForMatch } from "@/lib/equipment/text-normalize";

export type HolderUser = { id: number; first_name: string; last_name: string };
export type HolderMatch =
  | { kind: "full" | "surname"; userId: number }
  | { kind: "ambiguous"; userIds: number[] }
  | { kind: "none" };

export type HolderItem = {
  id: number;
  name: string;
  notes: string | null;
  status: string | null;
  hasOpenAssignment: boolean;
};

export type HolderRow = {
  itemId: number;
  userId: number;
  kind: "full" | "surname";
  holderText: string;
  /** Držitel už má otevřenou položku se stejným nebo podobným názvem — možná duplicitní záznam. */
  warning?: "same_name_holder";
};

export type HolderGroup = { kind: "ambiguous" | "none"; label: string; count: number; itemIds: number[] };

export type HolderPlan = {
  rows: HolderRow[];
  groups: HolderGroup[];
  skipped: { notInStock: number; alreadyAssigned: number };
};

/** Jméno z řádku „Pracovník: …“; bez něj null. */
export function parseNoteHolder(notes: string | null): string | null {
  for (const line of (notes ?? "").split(/\r?\n/)) {
    const match = /^\s*Pracovník:\s*(.*)$/.exec(line);
    if (match) return match[1].trim() || null;
  }
  return null;
}

const TITLE_RE = /(^|[^\p{L}])(ing|mgr|bc|mudr|judr|rndr|phdr|doc|prof|dis|ph\.?\s?d)\./giu;

/** Bez akademických titulů (Ing., Mgr., Bc., Ph.D., DiS. …), i bez mezery za tečkou. */
export function stripPersonTitles(s: string): string {
  return s
    .replace(TITLE_RE, "$1 ")
    .replace(/\s*,\s*$/, "")
    .replace(/\s*,\s+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/,$/, "")
    .trim();
}

export function classifyHolderMatch(raw: string, users: HolderUser[]): HolderMatch {
  if (raw.includes("/")) return { kind: "none" };
  const name = normalizeForMatch(stripPersonTitles(raw));
  if (!name) return { kind: "none" };

  const full = users.filter(
    (u) =>
      normalizeForMatch(`${u.last_name} ${u.first_name}`) === name ||
      normalizeForMatch(`${u.first_name} ${u.last_name}`) === name
  );
  if (full.length === 1) return { kind: "full", userId: full[0].id };
  if (full.length > 1) return { kind: "ambiguous", userIds: full.map((u) => u.id) };

  const surname = users.filter((u) => normalizeForMatch(u.last_name) === name);
  if (surname.length === 1) return { kind: "surname", userId: surname[0].id };
  if (surname.length > 1) return { kind: "ambiguous", userIds: surname.map((u) => u.id) };
  return { kind: "none" };
}

const GENERIC_NAME_WORDS = new Set(["mobil", "mobilni", "telefon"]);

function nameTokens(name: string): Set<string> {
  return new Set(
    normalizeForMatch(name)
      .split(/[^a-z0-9]+/)
      .filter((t) => t.length >= 2 && !GENERIC_NAME_WORDS.has(t))
  );
}

/**
 * Podobné názvy položek (možná duplicita): aspoň 2 společná slova a aspoň ¾ slov
 * kratšího názvu je i v delším — „Motorola Moto G86“ ~ „Mobil Motorola Moto G86“,
 * ale „Galaxy S25“ ≁ „Galaxy A15“.
 */
export function similarItemNames(a: string, b: string): boolean {
  const ta = nameTokens(a);
  const tb = nameTokens(b);
  const overlap = [...ta].filter((t) => tb.has(t)).length;
  const shorter = Math.min(ta.size, tb.size);
  return overlap >= 2 && shorter > 0 && overlap / shorter >= 0.75;
}

export function planHolderAssignments(
  items: HolderItem[],
  users: HolderUser[],
  openAssignments: { userId: number; itemName: string }[]
): HolderPlan {
  const heldNames = new Map<number, string[]>();
  for (const a of openAssignments) {
    heldNames.set(a.userId, [...(heldNames.get(a.userId) ?? []), a.itemName]);
  }

  const rows: HolderRow[] = [];
  const groups = new Map<string, HolderGroup>();
  const skipped = { notInStock: 0, alreadyAssigned: 0 };

  for (const item of items) {
    const holderText = parseNoteHolder(item.notes);
    if (!holderText) continue;
    if (item.status !== EQUIPMENT_ITEM_STATUS.SKLADEM) {
      skipped.notInStock += 1;
      continue;
    }
    if (item.hasOpenAssignment) {
      skipped.alreadyAssigned += 1;
      continue;
    }
    const match = classifyHolderMatch(holderText, users);
    if (match.kind === "full" || match.kind === "surname") {
      const duplicate = (heldNames.get(match.userId) ?? []).some(
        (held) => normalizeForMatch(held) === normalizeForMatch(item.name) || similarItemNames(held, item.name)
      );
      rows.push({
        itemId: item.id,
        userId: match.userId,
        kind: match.kind,
        holderText,
        ...(duplicate ? { warning: "same_name_holder" as const } : {}),
      });
      continue;
    }
    const key = `${match.kind}:${normalizeForMatch(holderText)}`;
    const group = groups.get(key) ?? { kind: match.kind, label: holderText, count: 0, itemIds: [] };
    group.count += 1;
    group.itemIds.push(item.id);
    groups.set(key, group);
  }

  return {
    rows,
    groups: [...groups.values()].sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, "cs")),
    skipped,
  };
}
