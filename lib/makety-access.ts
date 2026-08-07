import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  hasModuleAccess,
  hasExplicitMaketyZadavatelGrafikaRole,
  hasExplicitMaketyZadavatelMaketaRole,
  hasMaketyGrafikaAccess,
  hasMaketySchvalovatelFinalAccess,
  hasMaketySchvalovatelPrepressAccess,
  hasMaketyVyrobaAccess,
  isAdmin,
} from "@/lib/auth-utils";
import { type MaketyWorkType } from "@/lib/makety-work-type";
import {
  getAllowedGrafikaTransitions,
  type GrafikaTransitionRole,
  type GrafikaStatus,
} from "@/lib/makety-grafika-status";
import { isMaketaTerminalStatus } from "@/lib/makety-status";

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

/** Může zakládat/editovat vlastní zakázky daného typu (admin modulu = oba typy). */
export async function canZadatMaketyWork(userId: number, workType: MaketyWorkType): Promise<boolean> {
  if (await canViewAllMaketyTypes(userId)) return true;
  if (workType === "maketa" && (await hasExplicitMaketyZadavatelMaketaRole(userId))) return true;
  if (workType === "grafika" && (await hasExplicitMaketyZadavatelGrafikaRole(userId))) return true;
  return false;
}

/** Alespoň jeden typ zadavatele – záložka Sledování zadání. */
export async function canZadatAnyMaketyWork(userId: number): Promise<boolean> {
  if (await canViewAllMaketyTypes(userId)) return true;
  return (
    (await hasExplicitMaketyZadavatelMaketaRole(userId)) ||
    (await hasExplicitMaketyZadavatelGrafikaRole(userId))
  );
}

/** Kalendář maket na plotru v modulu Makety (org přehled nebo vlastní zakázky zadavatele). */
export async function canViewMaketyPlotrCalendar(userId: number): Promise<boolean> {
  if (await canViewAllMaketyTypes(userId)) return true;
  if (await hasMaketyVyrobaAccess(userId)) return true;
  return canZadatMaketyWork(userId, "maketa");
}

/** Kalendář grafiky v modulu Makety. */
export async function canViewMaketyGrafikaCalendar(userId: number): Promise<boolean> {
  if (await canViewAllMaketyTypes(userId)) return true;
  if (await hasMaketyGrafikaAccess(userId)) return true;
  if (await hasMaketySchvalovatelPrepressAccess(userId)) return true;
  if (await hasMaketySchvalovatelFinalAccess(userId)) return true;
  return canZadatMaketyWork(userId, "grafika");
}

/**
 * null = bez filtru work_type (admin modulu / všichni typy u osobního přehledu).
 * Pole = org-wide fronta jen pro uvedené typy (vyroba → maketa, grafika → grafika).
 */
export async function getOrgWideWorkTypes(userId: number): Promise<MaketyWorkType[] | null> {
  if (await canViewAllMaketyTypes(userId)) return null;
  const types: MaketyWorkType[] = [];
  if (await hasMaketyVyrobaAccess(userId)) types.push("maketa");
  if (
    (await hasMaketyGrafikaAccess(userId)) ||
    (await hasMaketySchvalovatelPrepressAccess(userId)) ||
    (await hasMaketySchvalovatelFinalAccess(userId))
  ) {
    types.push("grafika");
  }
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
  if (workType === "grafika") {
    if (await hasMaketyGrafikaAccess(userId)) return true;
    if (await hasMaketySchvalovatelPrepressAccess(userId)) return true;
    if (await hasMaketySchvalovatelFinalAccess(userId)) return true;
  }
  return false;
}

export async function userCanViewMaketa(userId: number, maketaId: number): Promise<boolean> {
  const row = await prisma.makety.findFirst({
    where: { id: maketaId },
    select: {
      id: true,
      work_type: true,
      created_by: true,
      assignee_user_id: true,
      prepress_user_id: true,
      final_approver_user_id: true,
    },
  });
  if (!row) return false;

  const workType = (row.work_type === "grafika" ? "grafika" : "maketa") as MaketyWorkType;
  if (await userHasOrgAccessToWorkType(userId, workType)) return true;

  return (
    row.created_by === userId ||
    row.assignee_user_id === userId ||
    row.prepress_user_id === userId ||
    row.final_approver_user_id === userId
  );
}

export async function userCanEditMaketa(userId: number, maketaId: number): Promise<boolean> {
  const row = await prisma.makety.findFirst({
    where: { id: maketaId, created_by: userId },
    select: { id: true, status: true, work_type: true },
  });
  if (!row) return false;
  const workType = (row.work_type === "grafika" ? "grafika" : "maketa") as MaketyWorkType;
  if (isMaketaTerminalStatus(row.status, workType)) return false;
  if (!(await canZadatMaketyWork(userId, workType))) return false;
  if (workType === "maketa") {
    return row.status === "awaiting_quote" || row.status === "quote_submitted";
  }
  return true;
}

/** Výrobce odešle kalkulaci ceny (jen maketa, stav awaiting_quote). */
export async function userCanSubmitMaketaQuote(userId: number, maketaId: number): Promise<boolean> {
  const row = await prisma.makety.findFirst({
    where: { id: maketaId },
    select: {
      id: true,
      work_type: true,
      status: true,
      assignee_user_id: true,
    },
  });
  if (!row) return false;
  if (row.work_type !== "maketa" || row.status !== "awaiting_quote") return false;
  if (row.assignee_user_id === userId) return true;
  if (await canViewAllMaketyTypes(userId)) return true;
  return false;
}

/** Zadavatel schválí / zamítne nabídku (stav quote_submitted). */
export async function userCanApproveMaketaQuote(userId: number, maketaId: number): Promise<boolean> {
  const row = await prisma.makety.findFirst({
    where: { id: maketaId },
    select: { id: true, work_type: true, status: true, created_by: true },
  });
  if (!row) return false;
  if (row.work_type !== "maketa" || row.status !== "quote_submitted") return false;
  if (await canViewAllMaketyTypes(userId)) return true;
  if (row.created_by !== userId) return false;
  return canZadatMaketyWork(userId, "maketa");
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

/** Role pro prepress přechody stavů u grafiky. */
export async function getGrafikaTransitionRoles(
  userId: number,
  maketaId: number
): Promise<GrafikaTransitionRole[]> {
  const row = await prisma.makety.findFirst({
    where: { id: maketaId, work_type: "grafika" },
    select: {
      id: true,
      status: true,
      created_by: true,
      assignee_user_id: true,
      prepress_user_id: true,
      final_approver_user_id: true,
    },
  });
  if (!row || isMaketaTerminalStatus(row.status, "grafika")) return [];

  const roles = new Set<GrafikaTransitionRole>();
  const isModuleAdmin = await canViewAllMaketyTypes(userId);

  if (isModuleAdmin || row.assignee_user_id === userId) {
    roles.add("grafik");
  }
  if (isModuleAdmin || row.created_by === userId) {
    roles.add("zadavatel");
  }
  if (isModuleAdmin || row.prepress_user_id === userId) {
    roles.add("prepress");
  }
  if (isModuleAdmin || row.final_approver_user_id === userId) {
    roles.add("final");
  }

  return [...roles];
}

export async function userCanTransitionGrafika(
  userId: number,
  maketaId: number,
  toStatus: GrafikaStatus
): Promise<boolean> {
  const row = await prisma.makety.findFirst({
    where: { id: maketaId, work_type: "grafika" },
    select: { status: true },
  });
  if (!row) return false;
  const roles = await getGrafikaTransitionRoles(userId, maketaId);
  const allowed = getAllowedGrafikaTransitions(row.status, roles);
  return allowed.includes(toStatus);
}

/** Softproof / Cicero / produkt – finální schvalovatel nebo admin modulu. */
export async function userCanOperateGrafikaAutomation(
  userId: number,
  maketaId: number
): Promise<boolean> {
  if (await canViewAllMaketyTypes(userId)) return true;
  const row = await prisma.makety.findFirst({
    where: { id: maketaId, work_type: "grafika" },
    select: { final_approver_user_id: true },
  });
  return row != null && row.final_approver_user_id === userId;
}
