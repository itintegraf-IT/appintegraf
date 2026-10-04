/**
 * Příprava dat: zařazení položek do místností podle starého textu umístění
 * („Název místnosti (kód)“ z importu). Čistá logika bez DB — data dodá volající.
 *
 * Pravidla: kód místnosti vždy rozhoduje před názvem; automaticky jen tam, kde sedí
 * kód i název (nebo dřívější název sloučené místnosti); ostatní shody jsou návrhy
 * k potvrzení; zbytek zůstane ve skupinách k ruční obchůzce.
 */

import { EQUIPMENT_ITEM_STATUS } from "@/lib/equipment-status";
import { normalizeForMatch } from "@/lib/equipment/text-normalize";

export type ParsedLocation =
  | { kind: "empty" }
  | { kind: "coded"; name: string; code: string }
  | { kind: "costCenter"; name: string; code: string }
  | { kind: "text"; name: string };

export type PlanItem = { id: number; location: string | null; room_id: number | null; status: string | null };
export type PlanRoom = { id: number; code: string; name: string; description: string | null; is_active: boolean };

export type RoomPairReason = "code_name" | "code_alias" | "code_name_differs" | "name_only";
export type RoomPair = { itemId: number; roomId: number; location: string; reason: RoomPairReason };

export type LocationGroupKind = "empty" | "costCenter" | "unknownCode" | "text";
export type LocationGroup = { kind: LocationGroupKind; label: string; count: number; itemIds: number[] };

export type RoomPlan = {
  auto: RoomPair[];
  suggest: RoomPair[];
  groups: LocationGroup[];
  skipped: { alreadyPlaced: number; retired: number };
};

const CODED_RE = /^(.*?)\s*\(\s*([sS]?\d+)\s*\)\s*$/;
const APP_FORMAT_RE = /^(\d+)\s*[–—-]\s*(.+)$/;

/** „Název (kód)“, „Název (s20000)“ = středisko, „Název (0)“ = bez kódu, „1056 – Název“ = zápis aplikace. */
export function parseLocation(raw: string | null): ParsedLocation {
  const text = (raw ?? "").replace(/ /g, " ").trim();
  if (!text) return { kind: "empty" };
  const coded = CODED_RE.exec(text);
  if (coded) {
    const name = coded[1].trim();
    const code = coded[2];
    if (/^s/i.test(code)) return { kind: "costCenter", name, code };
    if (code === "0") return { kind: "text", name };
    return { kind: "coded", name, code };
  }
  const app = APP_FORMAT_RE.exec(text);
  if (app) return { kind: "coded", name: app[2].trim(), code: app[1] };
  return { kind: "text", name: text };
}

/** Dřívější názvy sloučených místností z popisu „Také: a; b“. */
export function parseRoomAliases(description: string | null): string[] {
  const match = /^\s*Také:\s*(.+)$/i.exec(description ?? "");
  if (!match) return [];
  return match[1]
    .split(";")
    .map((alias) => alias.trim())
    .filter(Boolean);
}

export function planRoomAssignments(items: PlanItem[], rooms: PlanRoom[]): RoomPlan {
  const active = rooms.filter((room) => room.is_active);
  const byCode = new Map(active.map((room) => [room.code.trim().toUpperCase(), room]));
  const aliasesOf = new Map(active.map((room) => [room.id, parseRoomAliases(room.description).map(normalizeForMatch)]));
  const byName = new Map<string, PlanRoom[]>();
  for (const room of active) {
    for (const key of [normalizeForMatch(room.name), ...(aliasesOf.get(room.id) ?? [])]) {
      const list = byName.get(key) ?? [];
      if (!list.includes(room)) list.push(room);
      byName.set(key, list);
    }
  }
  const uniqueByName = (name: string): PlanRoom | null => {
    const found = byName.get(normalizeForMatch(name)) ?? [];
    return found.length === 1 ? found[0] : null;
  };

  const auto: RoomPair[] = [];
  const suggest: RoomPair[] = [];
  const groups = new Map<string, LocationGroup>();
  const skipped = { alreadyPlaced: 0, retired: 0 };
  const addToGroup = (kind: LocationGroupKind, label: string, itemId: number) => {
    const key = kind === "empty" ? "empty" : `${kind}:${normalizeForMatch(label)}`;
    const group = groups.get(key) ?? { kind, label, count: 0, itemIds: [] };
    group.count += 1;
    group.itemIds.push(itemId);
    groups.set(key, group);
  };

  for (const item of items) {
    if (item.status === EQUIPMENT_ITEM_STATUS.VYRAZENO) {
      skipped.retired += 1;
      continue;
    }
    if (item.room_id != null) {
      skipped.alreadyPlaced += 1;
      continue;
    }
    const location = (item.location ?? "").trim();
    const parsed = parseLocation(item.location);

    if (parsed.kind === "empty") {
      addToGroup("empty", "Bez umístění", item.id);
      continue;
    }
    if (parsed.kind === "costCenter") {
      addToGroup("costCenter", location, item.id);
      continue;
    }
    if (parsed.kind === "coded") {
      const room = byCode.get(parsed.code.toUpperCase());
      if (room) {
        const name = normalizeForMatch(parsed.name);
        if (name === normalizeForMatch(room.name)) {
          auto.push({ itemId: item.id, roomId: room.id, location, reason: "code_name" });
        } else if ((aliasesOf.get(room.id) ?? []).includes(name)) {
          auto.push({ itemId: item.id, roomId: room.id, location, reason: "code_alias" });
        } else {
          suggest.push({ itemId: item.id, roomId: room.id, location, reason: "code_name_differs" });
        }
        continue;
      }
      const byNameRoom = uniqueByName(parsed.name);
      if (byNameRoom) {
        suggest.push({ itemId: item.id, roomId: byNameRoom.id, location, reason: "name_only" });
      } else {
        addToGroup("unknownCode", location, item.id);
      }
      continue;
    }
    const byNameRoom = uniqueByName(parsed.name);
    if (byNameRoom) {
      suggest.push({ itemId: item.id, roomId: byNameRoom.id, location, reason: "name_only" });
    } else {
      addToGroup("text", location, item.id);
    }
  }

  return {
    auto,
    suggest,
    groups: [...groups.values()].sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, "cs")),
    skipped,
  };
}
