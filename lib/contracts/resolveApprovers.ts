import type { PrismaClient, contract_workflow_steps } from "@prisma/client";
import { CONTRACT_SYSTEM_SETTING_KEYS } from "@/lib/contracts/resolver-keys";

export type ContractResolverContext = {
  /** Oddělení přímo u smlouvy; pokud null, použije se oddělení autora (`created_by`). */
  departmentId: number | null;
  createdByUserId: number;
};

export type ResolveApproverResult =
  | { ok: true; userId: number }
  | { ok: false; message: string };

/** Kanonická hodnota pro uložení do `contract_workflow_steps.resolver`. */
export function normalizeContractResolver(raw: string): string {
  const r = raw.trim().toLowerCase();
  if (r === "ceo") return "executive";
  if (r === "legal") return "legal_counsel";
  if (r === "financial" || r === "finance") return "financial_approval";
  return r;
}

async function parseUserIdSetting(
  db: PrismaClient,
  settingKey: string
): Promise<number | null> {
  const row = await db.system_settings.findUnique({
    where: { setting_key: settingKey },
    select: { setting_value: true },
  });
  if (!row?.setting_value?.trim()) return null;
  const n = parseInt(row.setting_value.trim(), 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

async function isUserActiveApprover(db: PrismaClient, userId: number): Promise<boolean> {
  const u = await db.users.findUnique({
    where: { id: userId },
    select: { is_active: true },
  });
  if (!u) return false;
  return u.is_active === true || u.is_active === null;
}

/**
 * Oddělení pro resolvování vedoucího: nejdřív smlouva, jinak hlavní oddělení autora.
 */
export async function resolveDepartmentIdForContract(
  db: PrismaClient,
  contract: { department_id: number | null; created_by: number }
): Promise<number | null> {
  if (contract.department_id != null) return contract.department_id;
  const u = await db.users.findUnique({
    where: { id: contract.created_by },
    select: { department_id: true },
  });
  return u?.department_id ?? null;
}

/**
 * Určí uživatele-schvalovatele pro jeden krok šablony při odeslání návrhu / dalším kroku.
 */
export async function resolveApproverForWorkflowStep(
  db: PrismaClient,
  step: Pick<contract_workflow_steps, "resolver" | "fixed_user_id">,
  context: ContractResolverContext
): Promise<ResolveApproverResult> {
  const resolver = normalizeContractResolver(step.resolver);

  if (resolver === "fixed_user") {
    const id = step.fixed_user_id;
    if (id == null) {
      return {
        ok: false,
        message:
          "Krok šablony s resolverem fixed_user musí mít vyplněného uživatele (fixed_user_id).",
      };
    }
    if (!(await isUserActiveApprover(db, id))) {
      return {
        ok: false,
        message: "Pevně zadaný schvalovatel neexistuje nebo není aktivní.",
      };
    }
    return { ok: true, userId: id };
  }

  if (resolver === "department_manager") {
    let deptId = context.departmentId;
    if (deptId == null) {
      const u = await db.users.findUnique({
        where: { id: context.createdByUserId },
        select: { department_id: true },
      });
      deptId = u?.department_id ?? null;
    }
    if (deptId == null) {
      return {
        ok: false,
        message:
          "Nelze určit vedoucího: chybí oddělení u smlouvy i u autora návrhu.",
      };
    }
    const dept = await db.departments.findUnique({
      where: { id: deptId },
      select: { manager_id: true, name: true },
    });
    const managerId = dept?.manager_id ?? null;
    if (managerId == null) {
      return {
        ok: false,
        message: `Oddělení „${dept?.name ?? deptId}“ nemá v systému přiřazeného vedoucího.`,
      };
    }
    if (!(await isUserActiveApprover(db, managerId))) {
      return {
        ok: false,
        message: "Vedoucí oddělení neexistuje nebo není aktivní.",
      };
    }
    return { ok: true, userId: managerId };
  }

  if (resolver === "legal_counsel") {
    const id = await parseUserIdSetting(db, CONTRACT_SYSTEM_SETTING_KEYS.legalUserId);
    if (id == null) {
      return {
        ok: false,
        message:
          "V administraci chybí nastavení právního zástupce (system_settings: contracts_resolver_legal_user_id).",
      };
    }
    if (!(await isUserActiveApprover(db, id))) {
      return {
        ok: false,
        message: "Uživatel nastavený jako právní zástupce neexistuje nebo není aktivní.",
      };
    }
    return { ok: true, userId: id };
  }

  if (resolver === "financial_approval") {
    const id = await parseUserIdSetting(
      db,
      CONTRACT_SYSTEM_SETTING_KEYS.financialUserId
    );
    if (id == null) {
      return {
        ok: false,
        message:
          "V administraci chybí nastavení ekonomického schvalovatele (system_settings: contracts_resolver_financial_user_id).",
      };
    }
    if (!(await isUserActiveApprover(db, id))) {
      return {
        ok: false,
        message:
          "Uživatel nastavený pro finanční schválení neexistuje nebo není aktivní.",
      };
    }
    return { ok: true, userId: id };
  }

  if (resolver === "executive") {
    const id = await parseUserIdSetting(
      db,
      CONTRACT_SYSTEM_SETTING_KEYS.executiveUserId
    );
    if (id == null) {
      return {
        ok: false,
        message:
          "V administraci chybí nastavení nejvyššího vedení (system_settings: contracts_resolver_executive_user_id).",
      };
    }
    if (!(await isUserActiveApprover(db, id))) {
      return {
        ok: false,
        message:
          "Uživatel nastavený jako nejvyšší vedení neexistuje nebo není aktivní.",
      };
    }
    return { ok: true, userId: id };
  }

  return {
    ok: false,
    message: `Neznámý resolver „${step.resolver}“. Použijte např. department_manager, legal_counsel, financial_approval, executive, fixed_user.`,
  };
}
