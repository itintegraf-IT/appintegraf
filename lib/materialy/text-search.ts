import type { Prisma } from "@prisma/client";

/** Dílčí řetězec ve všech hlavních textových polích materiálu včetně názvu podtypu. */
export function materialsTextSearchWhere(q: string): Prisma.materialsWhereInput | undefined {
  const t = q.trim();
  if (!t) return undefined;

  const or: Prisma.materialsWhereInput[] = [
    { name: { contains: t } },
    { code: { contains: t } },
    { manufacturer: { contains: t } },
    { supplier: { contains: t } },
    { description: { contains: t } },
    { cas_number: { contains: t } },
    { notes: { contains: t } },
    { material_subcategories: { name: { contains: t } } },
  ];

  if (/^\d+$/.test(t)) {
    const id = parseInt(t, 10);
    if (Number.isFinite(id)) or.push({ id });
  }

  return { OR: or };
}
