/**
 * Rozpoznání naskenovaného nebo ručně zadaného kódu — čistá logika bez DB
 * (použitelná i v klientu). Načtení kandidátů z DB: lib/equipment/scan-resolve.ts.
 */

import { extractQrUrlCode, QR_PREFIX_EQ, QR_PREFIX_RM } from "@/lib/equipment/qr-url";

export { QR_PREFIX_EQ, QR_PREFIX_RM };

export type ParsedEquipmentCode =
  | { kind: "eq"; code: string }
  | { kind: "rm"; code: string }
  | { kind: "raw"; code: string };

/** Parsuje naskenovaný text: odkaz `…/q/<kód>`, plný payload nebo holý kód. */
export function parseEquipmentScanCode(raw: string): ParsedEquipmentCode {
  const text = raw.trim();
  if (!text) return { kind: "raw", code: "" };
  return parseBareCode(extractQrUrlCode(text) ?? text);
}

function parseBareCode(text: string): ParsedEquipmentCode {
  const upper = text.toUpperCase();
  if (upper.startsWith(QR_PREFIX_EQ)) {
    return { kind: "eq", code: text.slice(QR_PREFIX_EQ.length).trim() };
  }
  if (upper.startsWith(QR_PREFIX_RM)) {
    return { kind: "rm", code: text.slice(QR_PREFIX_RM.length).trim() };
  }
  if (upper.startsWith("EQ-") || /^\d{12}$/.test(text)) {
    return { kind: "eq", code: text };
  }
  if (upper.startsWith("RM-")) {
    return { kind: "rm", code: text };
  }
  return { kind: "raw", code: text };
}

/** Co volající čeká: cokoli (skener), jen položku (inventura, přesun), jen místnost (cíl přesunu). */
export type ScanTarget = "any" | "item" | "room";

type Hit = { id: number };
export type ScanCandidates = {
  itemByTag?: Hit;
  itemByQr?: Hit;
  itemBySerial?: Hit;
  room?: Hit;
  pool?: { id: number; status: string; equipmentId: number | null };
};

export type ScanResolution =
  | { type: "item"; itemId: number }
  | { type: "room"; roomId: number }
  | { type: "qr_pool"; poolId: number }
  | { type: "ambiguous"; itemId: number; roomId: number }
  | { type: "wrong_kind"; found: "item" | "room" }
  | { type: "not_found" };

/**
 * Jediné pravidlo, co kód znamená:
 * - QR položky (eq) nikdy nenajde místnost, QR místnosti (rm) nikdy položku;
 * - holý kód shodný s položkou i místností: v "any" výslovná volba (ambiguous), jinak podle cíle;
 * - u položky má přednost inventární číslo, pak QR kód, pak sériové číslo;
 * - přiřazený kód z fondu vede na svou položku, volný zůstane kódem z fondu.
 */
export function decideScanResolution(
  parsed: ParsedEquipmentCode,
  c: ScanCandidates,
  target: ScanTarget
): ScanResolution {
  const room = parsed.kind === "eq" ? undefined : c.room;
  const poolItemId = c.pool?.status === "assigned" ? c.pool.equipmentId : null;
  const itemId =
    parsed.kind === "rm" ? null : (c.itemByTag?.id ?? c.itemByQr?.id ?? c.itemBySerial?.id ?? poolItemId ?? null);
  const freePool = parsed.kind !== "rm" && c.pool?.status === "available" ? c.pool : undefined;

  if (target === "room") {
    if (room) return { type: "room", roomId: room.id };
    return itemId != null || freePool ? { type: "wrong_kind", found: "item" } : { type: "not_found" };
  }
  if (target === "item") {
    if (itemId != null) return { type: "item", itemId };
    if (freePool) return { type: "qr_pool", poolId: freePool.id };
    return room ? { type: "wrong_kind", found: "room" } : { type: "not_found" };
  }
  if (itemId != null && room) return { type: "ambiguous", itemId, roomId: room.id };
  if (itemId != null) return { type: "item", itemId };
  if (room) return { type: "room", roomId: room.id };
  if (freePool) return { type: "qr_pool", poolId: freePool.id };
  return { type: "not_found" };
}
