import type { PrismaTransactionClient } from "@/lib/db";

/**
 * Číselná řada inventárních čísel drobného majetku (navazuje na řadu 100xxx
 * z účetnictví). Aplikace je od 1. 10. 2026 hlavní evidencí drobného majetku;
 * start řady nastaví správce jednou (poslední číslo z ABRA Gen + 1).
 */
export const ASSET_TAG_SERIES = { min: 100000, max: 199999 } as const;
export const ASSET_TAG_SERIES_SETTING_KEY = "equipment_asset_tag_series";

export type AssetTagSeries = { start: number; lastIssued: number | null };

/** Řada ještě není nastavená → automatické číslování odmítne uložit (pojistka proti kolizi s Gen). */
export class AssetNumberingNotConfiguredError extends Error {
  constructor() {
    super("Číselná řada inventárních čísel není nastavená.");
  }
}

function inSeries(n: unknown): n is number {
  return Number.isInteger(n) && (n as number) >= ASSET_TAG_SERIES.min && (n as number) <= ASSET_TAG_SERIES.max;
}

export function parseAssetTagSeries(value: string | null | undefined): AssetTagSeries | null {
  if (!value) return null;
  try {
    const raw = JSON.parse(value) as { start?: unknown; lastIssued?: unknown };
    if (!inSeries(raw.start)) return null;
    return { start: raw.start, lastIssued: inSeries(raw.lastIssued) ? raw.lastIssued : null };
  } catch {
    return null;
  }
}

/**
 * Další čísla řady. Rozhoduje nejvyšší z: start, poslední vydané + 1, nejvyšší
 * číslo řady v DB + 1 (ruční zadání). Vydané číslo se nikdy nepoužije znovu.
 */
export function nextSeriesTags(p: {
  start: number;
  lastIssued: number | null;
  maxInDb: number | null;
  count: number;
}): string[] {
  const first = Math.max(p.start, (p.lastIssued ?? 0) + 1, (p.maxInDb ?? 0) + 1);
  const last = first + p.count - 1;
  if (last > ASSET_TAG_SERIES.max) {
    throw new Error("Číselná řada inventárních čísel je vyčerpaná.");
  }
  return Array.from({ length: p.count }, (_, i) => String(first + i));
}

/** Nejnižší start, který nepovede ke kolizi s už použitými nebo vydanými čísly řady. */
export function firstAllowedSeriesStart(p: { maxInDb: number | null; lastIssued: number | null }): number {
  return Math.max(ASSET_TAG_SERIES.min, (p.maxInDb ?? 0) + 1, (p.lastIssued ?? 0) + 1);
}

export function validateSeriesStart(
  value: unknown,
  minAllowed: number
): { ok: true; start: number } | { ok: false; error: string } {
  const text = typeof value === "number" ? String(value) : typeof value === "string" ? value.trim() : "";
  if (!/^\d+$/.test(text)) {
    return { ok: false, error: "Zadejte celé číslo (např. 100876)." };
  }
  const start = Number(text);
  if (start < ASSET_TAG_SERIES.min || start > ASSET_TAG_SERIES.max) {
    return { ok: false, error: `Číslo musí být v řadě ${ASSET_TAG_SERIES.min}–${ASSET_TAG_SERIES.max}.` };
  }
  if (start < minAllowed) {
    return { ok: false, error: `Start řady musí být aspoň ${minAllowed} (vyšší než poslední použité číslo).` };
  }
  return { ok: true, start };
}

/** Nejvyšší číslo řady použité v položkách nebo ve fondu QR (null = žádné). */
export async function maxSeriesTagInDb(db: PrismaTransactionClient): Promise<number | null> {
  const rows = await db.$queryRaw<{ max: bigint | number | null }[]>`
    SELECT MAX(n) AS max FROM (
      SELECT CAST(asset_tag AS UNSIGNED) AS n FROM equipment_items WHERE asset_tag REGEXP '^1[0-9]{5}$'
      UNION ALL
      SELECT CAST(asset_tag AS UNSIGNED) AS n FROM equipment_qr_pool WHERE asset_tag REGEXP '^1[0-9]{5}$'
    ) t`;
  const max = rows[0]?.max;
  return max == null ? null : Number(max);
}

/** Jen pro zobrazení (stránka nastavení). Kdo podle hodnoty zapisuje, čte ji přes `lockAssetTagSeries`. */
export async function readAssetTagSeries(db: PrismaTransactionClient): Promise<AssetTagSeries | null> {
  const row = await db.system_settings.findUnique({
    where: { setting_key: ASSET_TAG_SERIES_SETTING_KEY },
    select: { setting_value: true },
  });
  return parseAssetTagSeries(row?.setting_value);
}

/**
 * Zamkne řádek nastavení řady do konce transakce (SELECT … FOR UPDATE) a vrátí
 * jeho hodnotu. Musí být PRVNÍM příkazem transakce — snapshot REPEATABLE READ
 * pak vznikne až po zámku, takže přidělování, ruční čísla i změna startu běží
 * postupně a každé vidí poslední vydané číslo.
 */
export async function lockAssetTagSeries(tx: PrismaTransactionClient): Promise<AssetTagSeries | null> {
  const rows = await tx.$queryRaw<{ setting_value: string | null }[]>`
    SELECT setting_value FROM system_settings WHERE setting_key = ${ASSET_TAG_SERIES_SETTING_KEY} FOR UPDATE`;
  return parseAssetTagSeries(rows[0]?.setting_value);
}

/**
 * Ručně zadané číslo ve tvaru řady (1xxxxx) od startu výš patří řadě: mohlo už
 * být vydané (položka mezitím smazaná) a překlep by řadu natrvalo posunul.
 * Bez nastavené řady jsou rezervovaná čísla nad nejvyšším použitým. Null = v pořádku.
 */
export function manualTagSeriesConflict(
  tag: string,
  p: { series: AssetTagSeries | null; maxInDb: number | null }
): string | null {
  if (!/^1\d{5}$/.test(tag)) return null;
  const n = Number(tag);
  if (p.series) {
    return n >= p.series.start
      ? `Čísla od ${p.series.start} výš přiděluje aplikace z číselné řady. Ručně zadejte jen číslo z ABRA Gen nebo starší číslo nižší než ${p.series.start}.`
      : null;
  }
  const reservedFrom = (p.maxInDb ?? ASSET_TAG_SERIES.min - 1) + 1;
  return n >= reservedFrom
    ? `Číselná řada ještě není nastavená — čísla řady od ${reservedFrom} výš zatím nejde zadat ručně.`
    : null;
}

/**
 * Nastaví start řady v transakci pod zámkem řady: nejnižší povolený start i poslední
 * vydané číslo se čtou až po zámku, takže souběžné přidělení nic nepřepíše.
 */
export async function setAssetTagSeriesStart(
  tx: PrismaTransactionClient,
  rawStart: unknown,
  userId: number
): Promise<{ ok: true; start: number; previous: AssetTagSeries | null } | { ok: false; error: string }> {
  const previous = await lockAssetTagSeries(tx);
  const minAllowed = firstAllowedSeriesStart({
    maxInDb: await maxSeriesTagInDb(tx),
    lastIssued: previous?.lastIssued ?? null,
  });
  const validated = validateSeriesStart(rawStart, minAllowed);
  if (!validated.ok) return validated;

  const value = JSON.stringify({ start: validated.start, lastIssued: previous?.lastIssued ?? null });
  await tx.system_settings.upsert({
    where: { setting_key: ASSET_TAG_SERIES_SETTING_KEY },
    create: {
      setting_key: ASSET_TAG_SERIES_SETTING_KEY,
      setting_value: value,
      module: "equipment",
      description: "Číselná řada inventárních čísel drobného majetku (start a poslední vydané číslo)",
      updated_by: userId,
    },
    update: { setting_value: value, module: "equipment", updated_by: userId, updated_at: new Date() },
  });
  return { ok: true, start: validated.start, previous };
}

/**
 * Přidělí `count` čísel uvnitř transakce. Prvním příkazem zamkne řádek
 * nastavení (`lockAssetTagSeries`), takže souběžná přidělení běží postupně.
 */
export async function allocateAssetTags(tx: PrismaTransactionClient, count: number): Promise<string[]> {
  const series = await lockAssetTagSeries(tx);
  if (!series) throw new AssetNumberingNotConfiguredError();

  const tags = nextSeriesTags({ ...series, maxInDb: await maxSeriesTagInDb(tx), count });
  await tx.system_settings.update({
    where: { setting_key: ASSET_TAG_SERIES_SETTING_KEY },
    data: {
      setting_value: JSON.stringify({ start: series.start, lastIssued: Number(tags[tags.length - 1]) }),
      updated_at: new Date(),
    },
  });
  return tags;
}

type AdapterErrorMeta = {
  driverAdapterError?: { cause?: { originalMessage?: string; constraint?: { index?: string } } };
};

/** Název unikátního indexu, na kterém vznikla kolize (Prisma P2002), jinak null. */
export function uniqueConstraintIndex(e: unknown): string | null {
  if (!e || typeof e !== "object" || (e as { code?: unknown }).code !== "P2002") return null;
  const cause = ((e as { meta?: AdapterErrorMeta }).meta?.driverAdapterError?.cause) ?? {};
  if (cause.constraint?.index) return cause.constraint.index;
  // MySQL: "for key 'tabulka.index'", MariaDB: "for key 'index'"
  const match = /for key '(?:[^'.]+\.)?([^']+)'/.exec(cause.originalMessage ?? "");
  return match ? match[1] : null;
}

const SERIES_INDEXES = new Set(["equipment_items_asset_tag_unique", "equipment_qr_pool_tag_unique"]);

/** Souběh dvou přidělení (kolize čísla řady) nebo deadlock → celou transakci zopakovat. */
export function isRetryableAllocationError(e: unknown): boolean {
  if (e && typeof e === "object" && (e as { code?: unknown }).code === "P2034") return true;
  const index = uniqueConstraintIndex(e);
  return index !== null && SERIES_INDEXES.has(index);
}
