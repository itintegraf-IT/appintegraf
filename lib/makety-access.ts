import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  hasModuleAccess,
  hasExplicitMaketyGrafikaRole,
  hasExplicitMaketyProhlizecKlientaRole,
  hasExplicitMaketySchvalovatelFinalRole,
  hasExplicitMaketySchvalovatelPrepressRole,
  hasExplicitMaketySpravaVzorkuRole,
  hasExplicitMaketyZadavatelGrafikaRole,
  hasExplicitMaketyZadavatelMaketaRole,
  hasMaketyGrafikaAccess,
  hasMaketySchvalovatelFinalAccess,
  hasMaketySchvalovatelPrepressAccess,
  hasMaketySpravaVzorkuAccess,
  hasMaketyVyrobaAccess,
  isAdmin,
} from "@/lib/auth-utils";
import { type MaketyWorkType } from "@/lib/makety-work-type";
import {
  listGrafikaTransitionOptions,
  type GrafikaTransitionRole,
  type GrafikaStatus,
} from "@/lib/makety-grafika-status";
import { isMaketaTerminalStatus } from "@/lib/makety-status";
import { getMaketyUserCustomerIds } from "@/lib/makety-user-customers";
import { isSoftproofDocumentType } from "@/lib/makety-file-kind";

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
  if (await hasMaketySpravaVzorkuAccess(userId)) return true;
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
    (await hasMaketySchvalovatelFinalAccess(userId)) ||
    (await hasMaketySpravaVzorkuAccess(userId))
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

/** Sestaví where pro seznam/archiv: org-wide fronta, prohlížeč klienta, nebo vlastní zakázky. */
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
  if (await isMaketyProhlizecKlientaOnly(userId)) {
    const ids = await getMaketyProhlizecCustomerIds(userId);
    where.work_type = "grafika";
    if (ids.length === 0) {
      where.id = -1;
    } else {
      where.customer_id = { in: ids };
    }
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

export async function getMaketyProhlizecCustomerIds(userId: number): Promise<number[]> {
  return getMaketyUserCustomerIds(userId);
}

/**
 * Má roli prohlížeče klienta a nemá silnější org práva na grafiku/makety
 * (admin, grafika, schvalovatelé, správa vzorků, zadavatel grafiky).
 */
export async function isMaketyProhlizecKlientaOnly(userId: number): Promise<boolean> {
  if (!(await hasExplicitMaketyProhlizecKlientaRole(userId))) return false;
  if (await canViewAllMaketyTypes(userId)) return false;
  if (await hasExplicitMaketyGrafikaRole(userId)) return false;
  if (await hasExplicitMaketySchvalovatelPrepressRole(userId)) return false;
  if (await hasExplicitMaketySchvalovatelFinalRole(userId)) return false;
  if (await hasExplicitMaketySpravaVzorkuRole(userId)) return false;
  if (await hasExplicitMaketyZadavatelGrafikaRole(userId)) return false;
  return true;
}

/**
 * Přístup k obsahu přílohy. Prohlížeč klienta jen softproof;
 * ostatní role se stejným oprávněním jako view makety.
 */
export async function userCanAccessMaketyFile(
  userId: number,
  maketaId: number,
  documentType: string | null | undefined
): Promise<boolean> {
  if (!(await userCanViewMaketa(userId, maketaId))) return false;
  if (!(await isMaketyProhlizecKlientaOnly(userId))) return true;
  return isSoftproofDocumentType(documentType);
}

/** @deprecated Preferujte userCanAccessMaketyFile s document_type. */
export async function userCanDownloadMaketyFile(
  userId: number,
  maketaId: number,
  documentType?: string | null
): Promise<boolean> {
  if (documentType !== undefined) {
    return userCanAccessMaketyFile(userId, maketaId, documentType);
  }
  if (await isMaketyProhlizecKlientaOnly(userId)) return false;
  return userCanViewMaketa(userId, maketaId);
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
    if (await hasMaketySpravaVzorkuAccess(userId)) return true;
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
      customer_id: true,
    },
  });
  if (!row) return false;

  const workType = (row.work_type === "grafika" ? "grafika" : "maketa") as MaketyWorkType;
  if (await userHasOrgAccessToWorkType(userId, workType)) return true;

  if (
    row.created_by === userId ||
    row.assignee_user_id === userId ||
    row.prepress_user_id === userId ||
    row.final_approver_user_id === userId
  ) {
    return true;
  }

  if (await isMaketyProhlizecKlientaOnly(userId)) {
    if (workType !== "grafika" || row.customer_id == null) return false;
    const ids = await getMaketyProhlizecCustomerIds(userId);
    return ids.includes(row.customer_id);
  }

  return false;
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

/**
 * Kopie zakázky – kdo ji vidí a zároveň smí zadávat daný typ (maketa/grafika).
 * Soubory, komentáře a historie stavů se nekopírují.
 */
export async function userCanCopyMaketa(userId: number, maketaId: number): Promise<boolean> {
  if (!(await userCanViewMaketa(userId, maketaId))) return false;
  const row = await prisma.makety.findFirst({
    where: { id: maketaId },
    select: { work_type: true },
  });
  if (!row) return false;
  const workType = (row.work_type === "grafika" ? "grafika" : "maketa") as MaketyWorkType;
  return canZadatMaketyWork(userId, workType);
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

/** Role pro přechody stavů u grafiky – jen přiřazená osoba (ne celý admin). */
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

  if (row.assignee_user_id === userId) {
    roles.add("grafik");
  }
  if (row.created_by === userId) {
    roles.add("zadavatel");
  }
  if (row.prepress_user_id === userId) {
    roles.add("prepress");
  }
  if (row.final_approver_user_id === userId) {
    roles.add("final");
  }

  return [...roles];
}

/** Zadavatel nebo admin modulu může převzít cizí krok s potvrzením. */
export async function userCanOverrideGrafikaTransitions(
  userId: number,
  maketaId: number
): Promise<boolean> {
  if (await canViewAllMaketyTypes(userId)) return true;
  const row = await prisma.makety.findFirst({
    where: { id: maketaId, work_type: "grafika" },
    select: { created_by: true },
  });
  return row != null && row.created_by === userId;
}

export async function resolveGrafikaTransitionAccess(
  userId: number,
  maketaId: number,
  toStatus: GrafikaStatus,
  acknowledgeOverride?: boolean
): Promise<
  | { ok: true; viaOverride: boolean; actingAs: GrafikaTransitionRole }
  | { ok: false; error: string; needsOverrideAck?: boolean }
> {
  const row = await prisma.makety.findFirst({
    where: { id: maketaId, work_type: "grafika" },
    select: { status: true },
  });
  if (!row) return { ok: false, error: "Zakázka nenalezena" };

  const roles = await getGrafikaTransitionRoles(userId, maketaId);
  const canOverride = await userCanOverrideGrafikaTransitions(userId, maketaId);
  const options = listGrafikaTransitionOptions(row.status, roles, canOverride);
  const opt = options.find((o) => o.toStatus === toStatus);
  if (!opt) {
    return { ok: false, error: "Nemáte oprávnění k tomuto přechodu" };
  }
  if (opt.viaOverride && !acknowledgeOverride) {
    return {
      ok: false,
      error: "Převzetí role vyžaduje potvrzení",
      needsOverrideAck: true,
    };
  }
  return { ok: true, viaOverride: opt.viaOverride, actingAs: opt.actingAs };
}

export async function userCanTransitionGrafika(
  userId: number,
  maketaId: number,
  toStatus: GrafikaStatus,
  acknowledgeOverride?: boolean
): Promise<boolean> {
  const resolved = await resolveGrafikaTransitionAccess(
    userId,
    maketaId,
    toStatus,
    acknowledgeOverride
  );
  return resolved.ok;
}

/** Softproof / produkt – finální schvalovatel, nebo override (zadavatel/admin). */
export async function userCanOperateGrafikaAutomation(
  userId: number,
  maketaId: number
): Promise<{ allowed: boolean; viaOverride: boolean }> {
  const row = await prisma.makety.findFirst({
    where: { id: maketaId, work_type: "grafika" },
    select: { final_approver_user_id: true },
  });
  if (!row) return { allowed: false, viaOverride: false };
  if (row.final_approver_user_id === userId) {
    return { allowed: true, viaOverride: false };
  }
  if (await userCanOverrideGrafikaTransitions(userId, maketaId)) {
    return { allowed: true, viaOverride: true };
  }
  return { allowed: false, viaOverride: false };
}

const GRAFIKA_FILE_DELETE_STATUSES = new Set(["open", "in_progress", "data_problem"]);

/**
 * Mazání přílohy: zadavatel u aktivní zakázky, admin (globální / modul),
 * nebo přiřazený grafik do odeslání dál (open / in_progress / data_problem).
 */
export async function userCanDeleteMaketyFile(
  userId: number,
  maketaId: number
): Promise<boolean> {
  if (await userCanEditMaketa(userId, maketaId)) return true;
  if (await canViewAllMaketyTypes(userId)) {
    const exists = await prisma.makety.findFirst({
      where: { id: maketaId },
      select: { id: true },
    });
    return exists != null;
  }
  const row = await prisma.makety.findFirst({
    where: { id: maketaId },
    select: {
      work_type: true,
      status: true,
      assignee_user_id: true,
    },
  });
  if (!row || row.work_type !== "grafika") return false;
  if (row.assignee_user_id !== userId) return false;
  return GRAFIKA_FILE_DELETE_STATUSES.has(row.status);
}
