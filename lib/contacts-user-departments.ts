import type { PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/db";

const MAX_SECONDARY = 2;

/** Ověří ID vůči aktivním oddělením, vrátí primární a max. 2 sekundární (bez duplicit s primárním). */
export async function resolveContactDepartmentIds(
  department_id: unknown,
  secondary_department_ids: unknown
): Promise<{ department_id: number | null; secondaryIds: number[] }> {
  const primaryRaw =
    department_id != null && department_id !== ""
      ? parseInt(String(department_id), 10)
      : NaN;
  const parsedPrimary = !Number.isNaN(primaryRaw) && primaryRaw > 0 ? primaryRaw : null;

  const rawArr = Array.isArray(secondary_department_ids) ? secondary_department_ids : [];
  const parsedSecondary = rawArr
    .map((x) => parseInt(String(x), 10))
    .filter((n) => !Number.isNaN(n) && n > 0);

  const candidateIds = [...new Set([...(parsedPrimary ? [parsedPrimary] : []), ...parsedSecondary])];
  if (candidateIds.length === 0) {
    return { department_id: null, secondaryIds: [] };
  }

  const validRows = await prisma.departments.findMany({
    where: {
      id: { in: candidateIds },
      OR: [{ is_active: true }, { is_active: null }],
    },
    select: { id: true },
  });
  const validSet = new Set(validRows.map((r) => r.id));

  const primary = parsedPrimary && validSet.has(parsedPrimary) ? parsedPrimary : null;

  const secondaryIds: number[] = [];
  for (const id of parsedSecondary) {
    if (!validSet.has(id) || id === primary) continue;
    if (!secondaryIds.includes(id)) secondaryIds.push(id);
    if (secondaryIds.length >= MAX_SECONDARY) break;
  }

  return { department_id: primary, secondaryIds };
}

type DeptWriteClient = Pick<PrismaClient, "user_secondary_departments">;

export async function replaceUserSecondaryDepartments(
  db: DeptWriteClient,
  userId: number,
  primaryId: number | null,
  secondaryIds: number[]
) {
  await db.user_secondary_departments.deleteMany({ where: { user_id: userId } });
  for (const deptId of secondaryIds) {
    if (deptId !== primaryId) {
      await db.user_secondary_departments.create({
        data: { user_id: userId, department_id: deptId },
      });
    }
  }
}
