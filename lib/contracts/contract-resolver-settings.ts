import { prisma } from "@/lib/db";
import { CONTRACT_SYSTEM_SETTING_KEYS } from "@/lib/contracts/resolver-keys";

const MODULE = "contracts";

async function getUserIdForKey(key: string): Promise<number | null> {
  const row = await prisma.system_settings.findUnique({
    where: { setting_key: key },
    select: { setting_value: true },
  });
  if (!row?.setting_value?.trim()) return null;
  const n = parseInt(row.setting_value.trim(), 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

async function loadUserPreview(id: number | null) {
  if (id == null) return null;
  const u = await prisma.users.findUnique({
    where: { id },
    select: { id: true, first_name: true, last_name: true, is_active: true },
  });
  return u;
}

export type ContractResolverSettingsAdmin = {
  legalUserId: number | null;
  financialUserId: number | null;
  executiveUserId: number | null;
  preview: {
    legal: { id: number; first_name: string; last_name: string } | null;
    financial: { id: number; first_name: string; last_name: string } | null;
    executive: { id: number; first_name: string; last_name: string } | null;
  };
  /** ID je v nastavení, ale uživatel v DB chybí (např. smazán). */
  warnings: {
    legal?: string;
    financial?: string;
    executive?: string;
  };
};

export async function getContractResolverSettingsForAdmin(): Promise<ContractResolverSettingsAdmin> {
  const [legalUserId, financialUserId, executiveUserId] = await Promise.all([
    getUserIdForKey(CONTRACT_SYSTEM_SETTING_KEYS.legalUserId),
    getUserIdForKey(CONTRACT_SYSTEM_SETTING_KEYS.financialUserId),
    getUserIdForKey(CONTRACT_SYSTEM_SETTING_KEYS.executiveUserId),
  ]);

  const [legal, financial, executive] = await Promise.all([
    loadUserPreview(legalUserId),
    loadUserPreview(financialUserId),
    loadUserPreview(executiveUserId),
  ]);

  return {
    legalUserId,
    financialUserId,
    executiveUserId,
    preview: {
      legal: legal
        ? { id: legal.id, first_name: legal.first_name, last_name: legal.last_name }
        : null,
      financial: financial
        ? { id: financial.id, first_name: financial.first_name, last_name: financial.last_name }
        : null,
      executive: executive
        ? { id: executive.id, first_name: executive.first_name, last_name: executive.last_name }
        : null,
    },
    warnings: {
      legal:
        legalUserId != null && !legal
          ? `Uživatel s ID ${legalUserId} v systému neexistuje.`
          : undefined,
      financial:
        financialUserId != null && !financial
          ? `Uživatel s ID ${financialUserId} v systému neexistuje.`
          : undefined,
      executive:
        executiveUserId != null && !executive
          ? `Uživatel s ID ${executiveUserId} v systému neexistuje.`
          : undefined,
    },
  };
}

export type ContractResolverSettingsInput = {
  legal_user_id?: string | number | null;
  financial_user_id?: string | number | null;
  executive_user_id?: string | number | null;
};

/** Vrátí null = prázdné, číslo = platné ID, -1 = neplatné vstupní pole (volající má vrátit 400). */
function parseContractResolverIdInput(raw: unknown): number | null | -1 {
  if (raw === null || raw === undefined) return null;
  const s = String(raw).trim();
  if (s === "") return null;
  const n = parseInt(s, 10);
  if (!Number.isFinite(n) || n < 1) return -1;
  return n;
}

export async function saveContractResolverSettings(
  input: ContractResolverSettingsInput,
  updatedBy: number
): Promise<{ ok: true } | { ok: false; error: string }> {
  const legal = parseContractResolverIdInput(input.legal_user_id);
  const financial = parseContractResolverIdInput(input.financial_user_id);
  const executive = parseContractResolverIdInput(input.executive_user_id);

  if (legal === -1 || financial === -1 || executive === -1) {
    return { ok: false, error: "ID uživatele musí být kladné celé číslo nebo prázdné." };
  }

  const pairs: [string, number | null][] = [
    [CONTRACT_SYSTEM_SETTING_KEYS.legalUserId, legal],
    [CONTRACT_SYSTEM_SETTING_KEYS.financialUserId, financial],
    [CONTRACT_SYSTEM_SETTING_KEYS.executiveUserId, executive],
  ];

  for (const [, uid] of pairs) {
    if (uid == null) continue;
    const u = await prisma.users.findUnique({
      where: { id: uid },
      select: { id: true },
    });
    if (!u) {
      return { ok: false, error: `Uživatel s ID ${uid} v systému neexistuje.` };
    }
  }

  const upsert = async (key: string, userId: number | null) => {
    const str = userId == null ? "" : String(userId);
    await prisma.system_settings.upsert({
      where: { setting_key: key },
      create: {
        setting_key: key,
        setting_value: str,
        module: MODULE,
        description: null,
        updated_by: updatedBy,
      },
      update: {
        setting_value: str,
        module: MODULE,
        updated_by: updatedBy,
        updated_at: new Date(),
      },
    });
  };

  await Promise.all(
    pairs.map(([key, uid]) => upsert(key, uid))
  );

  return { ok: true };
}
