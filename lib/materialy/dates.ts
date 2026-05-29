/** Bezpečné mapování vstupu z formuláře (datum nebo prázdný řetězec) na Prisma DateTime / null. */
export function parseMaterialOptionalDate(v: unknown): Date | null {
  if (v == null || v === "") return null;
  const d = new Date(String(v));
  return Number.isNaN(d.getTime()) ? null : d;
}
