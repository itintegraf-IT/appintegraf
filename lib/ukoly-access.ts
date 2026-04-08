import { prisma } from "@/lib/db";
import { hasModuleAccess } from "@/lib/auth-utils";
import { getUserDepartmentIds } from "@/lib/ukoly-recipients";

export async function userCanViewUkol(userId: number, ukolId: number): Promise<boolean> {
  const deptIds = await getUserDepartmentIds(userId);
  const row = await prisma.ukoly.findFirst({
    where: {
      id: ukolId,
      OR: [
        { created_by: userId },
        { assignee_user_id: userId },
        ...(deptIds.length > 0
          ? [{ ukoly_departments: { some: { department_id: { in: deptIds } } } }]
          : []),
      ],
    },
    select: { id: true },
  });
  return row != null;
}

export async function userCanEditUkol(
  userId: number,
  ukolId: number
): Promise<boolean> {
  if (!(await hasModuleAccess(userId, "ukoly", "write"))) return false;
  const row = await prisma.ukoly.findFirst({
    where: { id: ukolId, created_by: userId },
    select: { id: true },
  });
  return row != null;
}

export async function userCanCompleteUkol(
  userId: number,
  ukolId: number
): Promise<boolean> {
  if (!(await hasModuleAccess(userId, "ukoly", "read"))) return false;
  const deptIds = await getUserDepartmentIds(userId);
  const row = await prisma.ukoly.findFirst({
    where: {
      id: ukolId,
      status: { notIn: ["done", "cancelled"] },
      OR: [
        { assignee_user_id: userId },
        { created_by: userId },
        ...(deptIds.length > 0
          ? [{ ukoly_departments: { some: { department_id: { in: deptIds } } } }]
          : []),
      ],
    },
    select: { id: true },
  });
  return row != null;
}
