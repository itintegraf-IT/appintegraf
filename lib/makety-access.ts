import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  hasModuleAccess,
  hasMaketyGrafikaAccess,
  hasMaketyVyrobaAccess,
  isAdmin,
} from "@/lib/auth-utils";
import { type MaketyWorkType } from "@/lib/makety-work-type";

/** Správa fronty výroby (řazení, priorita) – admin modulu nebo globální admin. */
export async function canManageMaketyQueue(userId: number): Promise<boolean> {
  return canViewAllMaketyTypes(userId);
}

/** Alias: správa modulu (přehled všech zakázek, fronta, priorita, mazání). */
export async function canAdministerMakety(userId: number): Promise<boolean> {
  return canViewAllMaketyTypes(userId);
}

/** Globální admin nebo admin modulu – vidí všechny typy zakázek. */
export async function canViewAllMaketyTypes(userId: number): Promise<boolean> {
  if (await isAdmin(userId)) return true;
  return hasModuleAccess(userId, "makety", "admin");
}

/**
 * null = bez filtru work_type (admin modulu / všichni typy u osobního přehledu).
 * Pole = org-wide fronta jen pro uvedené typy (vyroba → maketa, grafika → grafika).
 */
export async function getOrgWideWorkTypes(userId: number): Promise<MaketyWorkType[] | null> {
  if (await canViewAllMaketyTypes(userId)) return null;
  const types: MaketyWorkType[] = [];
  if (await hasMaketyVyrobaAccess(userId)) types.push("maketa");
  if (await hasMaketyGrafikaAccess(userId)) types.push("grafika");
  return types.length > 0 ? types : null;
}

export function applyWorkTypeToWhere(
  where: Prisma.maketyWhereInput,
  types: MaketyWorkType[] | null
): void {
  if (!types || types.length === 0) return;
  where.work_type = types.length === 1 ? types[0] : { in: types };
}

/** Sestaví where pro seznam/archiv: org-wide fronta nebo vlastní zakázky. */
export async function buildMaketyListWhere(
  userId: number,
  extra?: Prisma.maketyWhereInput
): Promise<Prisma.maketyWhereInput> {
  const where: Prisma.maketyWhereInput = { ...extra };
  const orgTypes = await getOrgWideWorkTypes(userId);
  if (orgTypes) {
    applyWorkTypeToWhere(where, orgTypes);
    return where;
  }
  if (await canViewAllMaketyTypes(userId)) {
    return where;
  }
  where.OR = [{ created_by: userId }, { assignee_user_id: userId }];
  return where;
}

/** @deprecated Použijte canViewAllMaketyTypes nebo getOrgWideWorkTypes */
export async function canViewAllMakety(userId: number): Promise<boolean> {
  if (await canViewAllMaketyTypes(userId)) return true;
  const types = await getOrgWideWorkTypes(userId);
  return types != null && types.length > 0;
}

async function userHasOrgAccessToWorkType(
  userId: number,
  workType: MaketyWorkType
): Promise<boolean> {
  if (await canViewAllMaketyTypes(userId)) return true;
  if (workType === "maketa" && (await hasMaketyVyrobaAccess(userId))) return true;
  if (workType === "grafika" && (await hasMaketyGrafikaAccess(userId))) return true;
  return false;
}

export async function userCanViewMaketa(userId: number, maketaId: number): Promise<boolean> {
  const row = await prisma.makety.findFirst({
    where: { id: maketaId },
    select: { id: true, work_type: true, created_by: true, assignee_user_id: true },
  });
  if (!row) return false;

  const workType = (row.work_type === "grafika" ? "grafika" : "maketa") as MaketyWorkType;
  if (await userHasOrgAccessToWorkType(userId, workType)) return true;

  return row.created_by === userId || row.assignee_user_id === userId;
}

export async function userCanEditMaketa(userId: number, maketaId: number): Promise<boolean> {
  if (!(await hasModuleAccess(userId, "makety", "write"))) return false;
  const row = await prisma.makety.findFirst({
    where: { id: maketaId, created_by: userId },
    select: { id: true, status: true },
  });
  if (!row) return false;
  return row.status !== "done" && row.status !== "cancelled";
}

/** Smazání – zadavatel u své aktivní zakázky, nebo admin modulu / globální admin. */
export async function userCanDeleteMaketa(userId: number, maketaId: number): Promise<boolean> {
  if (await userCanEditMaketa(userId, maketaId)) return true;
  if (!(await canViewAllMaketyTypes(userId))) return false;
  const row = await prisma.makety.findFirst({
    where: { id: maketaId },
    select: { id: true },
  });
  return row != null;
}

export async function userCanCompleteMaketa(userId: number, maketaId: number): Promise<boolean> {
  const row = await prisma.makety.findFirst({
    where: { id: maketaId, status: { notIn: ["done", "cancelled"] } },
    select: { id: true, work_type: true, created_by: true, assignee_user_id: true },
  });
  if (!row) return false;

  const workType = (row.work_type === "grafika" ? "grafika" : "maketa") as MaketyWorkType;
  if (await userHasOrgAccessToWorkType(userId, workType)) return true;

  if (!(await hasModuleAccess(userId, "makety", "read"))) return false;
  return row.created_by === userId || row.assignee_user_id === userId;
}
