/**
 * Výběr a pořadí štítků k tisku — čistá logika bez DB.
 * Položky se tisknou po místnostech, aby se štítkovalo místnost po místnosti.
 */

export const MAX_LABELS_PER_PRINT = 500;

/**
 * ID z požadavku: celá kladná čísla bez duplicit v původním pořadí. Požadavek s víc než
 * 500 hodnotami se odmítne hned — obří pole by jinak zbytečně zaměstnalo server.
 */
export function parseLabelIds(raw: unknown): { ok: true; ids: number[] } | { ok: false; error: string } {
  const values = Array.isArray(raw) ? raw : [];
  if (values.length > MAX_LABELS_PER_PRINT) {
    return { ok: false, error: `Najednou lze tisknout nejvýše ${MAX_LABELS_PER_PRINT} štítků.` };
  }
  const ids = new Set<number>();
  for (const value of values) {
    const n = typeof value === "number" ? value : Number(String(value).trim());
    if (Number.isInteger(n) && n > 0) ids.add(n);
  }
  if (ids.size === 0) return { ok: false, error: "Vyberte, co chcete tisknout." };
  return { ok: true, ids: [...ids] };
}

/** Štítek jde vytisknout jen s QR kódem; ostatní se přeskočí a nahlásí. */
export function splitPrintable<T extends { qr_code: string | null }>(items: T[]): { printable: T[]; skipped: T[] } {
  const printable: T[] = [];
  const skipped: T[] = [];
  for (const item of items) (item.qr_code ? printable : skipped).push(item);
  return { printable, skipped };
}

const collator = new Intl.Collator("cs", { numeric: true, sensitivity: "base" });

/** Po místnostech (bez místnosti na konec), uvnitř podle inventárního čísla, pak podle ID. */
export function sortItemsForLabels<T extends { id: number; roomName: string | null; assetTag: string | null }>(
  items: T[]
): T[] {
  return [...items].sort((a, b) => {
    if (a.roomName !== b.roomName) {
      if (a.roomName == null) return 1;
      if (b.roomName == null) return -1;
      const byRoom = collator.compare(a.roomName, b.roomName);
      if (byRoom !== 0) return byRoom;
    }
    if (a.assetTag !== b.assetTag) {
      if (a.assetTag == null) return 1;
      if (b.assetTag == null) return -1;
      const byTag = collator.compare(a.assetTag, b.assetTag);
      if (byTag !== 0) return byTag;
    }
    return a.id - b.id;
  });
}

/** Místnosti podle kódu (číselně). */
export function sortRoomsForLabels<T extends { id: number; code: string }>(rooms: T[]): T[] {
  return [...rooms].sort((a, b) => collator.compare(a.code, b.code) || a.id - b.id);
}
