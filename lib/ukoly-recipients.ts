import { prisma } from "@/lib/db";

export async function getUserDepartmentIds(userId: number): Promise<number[]> {
  const u = await prisma.users.findUnique({
    where: { id: userId },
    select: {
      department_id: true,
      user_secondary_departments: { select: { department_id: true } },
    },
  });
  const ids = new Set<number>();
  if (u?.department_id) ids.add(u.department_id);
  for (const s of u?.user_secondary_departments ?? []) ids.add(s.department_id);
  return [...ids];
}

export async function getActiveUserIdsInDepartments(departmentIds: number[]): Promise<number[]> {
  if (departmentIds.length === 0) return [];
  const rows = await prisma.users.findMany({
    where: {
      is_active: true,
      OR: [
        { department_id: { in: departmentIds } },
        { user_secondary_departments: { some: { department_id: { in: departmentIds } } } },
      ],
    },
    select: { id: true },
  });
  return [...new Set(rows.map((r) => r.id))];
}

/**
 * Příjemci notifikací/e-mailů: přiřazený uživatel + všichni aktivní členové vybraných oddělení (bez duplicit).
 */
export async function collectUkolNotifyUserIds(
  assigneeUserId: number | null,
  departmentIds: number[]
): Promise<number[]> {
  const set = new Set<number>();
  if (assigneeUserId != null) {
    const u = await prisma.users.findFirst({
      where: { id: assigneeUserId, is_active: true },
      select: { id: true },
    });
    if (u) set.add(u.id);
  }
  const fromDepts = await getActiveUserIdsInDepartments(departmentIds);
  for (const id of fromDepts) set.add(id);
  return [...set];
}
