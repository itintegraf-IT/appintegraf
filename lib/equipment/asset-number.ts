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

export async function readAssetTagSeries(db: PrismaTransactionClient): Promise<AssetTagSeries | null> {
  const row = await db.system_settings.findUnique({
    where: { setting_key: ASSET_TAG_SERIES_SETTING_KEY },
    select: { setting_value: true },
  });
  return parseAssetTagSeries(row?.setting_value);
}

/** Uloží start řady; poslední vydané číslo zachová. */
export async function saveAssetTagSeriesStart(
  db: PrismaTransactionClient,
  start: number,
  userId: number
): Promise<void> {
  const current = await readAssetTagSeries(db);
  const value = JSON.stringify({ start, lastIssued: current?.lastIssued ?? null });
  await db.system_settings.upsert({
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
}

/**
 * Přidělí `count` čísel uvnitř transakce. Prvním příkazem zamkne řádek
 * nastavení (SELECT … FOR UPDATE), takže souběžná přidělení běží postupně.
 */
export async function allocateAssetTags(tx: PrismaTransactionClient, count: number): Promise<string[]> {
  const rows = await tx.$queryRaw<{ setting_value: string | null }[]>`
    SELECT setting_value FROM system_settings WHERE setting_key = ${ASSET_TAG_SERIES_SETTING_KEY} FOR UPDATE`;
  const series = parseAssetTagSeries(rows[0]?.setting_value);
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
