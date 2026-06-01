import { prisma } from "@/lib/db";
import { hasModuleAccess, hasMaketyVyrobaAccess, isAdmin } from "@/lib/auth-utils";

export async function canViewAllMakety(userId: number): Promise<boolean> {
  if (await isAdmin(userId)) return true;
  if (await hasMaketyVyrobaAccess(userId)) return true;
  return hasModuleAccess(userId, "makety", "admin");
}

export async function userCanViewMaketa(userId: number, maketaId: number): Promise<boolean> {
  if (await canViewAllMakety(userId)) {
    const row = await prisma.makety.findFirst({
      where: { id: maketaId },
      select: { id: true },
    });
    return row != null;
  }

  const row = await prisma.makety.findFirst({
    where: {
      id: maketaId,
      OR: [{ created_by: userId }, { assignee_user_id: userId }],
    },
    select: { id: true },
  });
  return row != null;
}

export async function userCanEditMaketa(userId: number, maketaId: number): Promise<boolean> {
  if (!(await hasModuleAccess(userId, "makety", "write"))) return false;
  const row = await prisma.makety.findFirst({
    where: { id: maketaId, created_by: userId },
    select: { id: true },
  });
  return row != null;
}

export async function userCanCompleteMaketa(userId: number, maketaId: number): Promise<boolean> {
  if (await hasMaketyVyrobaAccess(userId) || (await hasModuleAccess(userId, "makety", "admin"))) {
    const row = await prisma.makety.findFirst({
      where: { id: maketaId, status: { notIn: ["done", "cancelled"] } },
      select: { id: true },
    });
    return row != null;
  }
  if (!(await hasModuleAccess(userId, "makety", "read"))) return false;

  const row = await prisma.makety.findFirst({
    where: {
      id: maketaId,
      status: { notIn: ["done", "cancelled"] },
      OR: [{ assignee_user_id: userId }, { created_by: userId }],
    },
    select: { id: true },
  });
  return row != null;
}
