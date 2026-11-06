import { hasModuleAccess } from "@/lib/auth-utils";

export async function canReadTechnologie(userId: number): Promise<boolean> {
  return hasModuleAccess(userId, "technologie", "read");
}

export async function canWriteTechnologie(userId: number): Promise<boolean> {
  return hasModuleAccess(userId, "technologie", "write");
}

/** Čtení IML-označených technologií z modulu IML (bez oprávnění Technologie). */
export async function canReadImlTaggedTechnologie(userId: number): Promise<boolean> {
  return hasModuleAccess(userId, "iml", "read");
}

/**
 * Přístup ke konkrétnímu záznamu: plný modul Technologie, nebo IML read u `is_iml`.
 */
export async function canReadTechnologieRecord(
  userId: number,
  record: { is_iml: boolean }
): Promise<boolean> {
  if (await canReadTechnologie(userId)) return true;
  if (record.is_iml && (await canReadImlTaggedTechnologie(userId))) return true;
  return false;
}

/** Smí volat list API (technologie read, nebo jen IML read → vždy filtrovat is_iml). */
export async function getTechnologieListAccess(userId: number): Promise<
  | { ok: false }
  | { ok: true; forceImlOnly: boolean }
> {
  if (await canReadTechnologie(userId)) {
    return { ok: true, forceImlOnly: false };
  }
  if (await canReadImlTaggedTechnologie(userId)) {
    return { ok: true, forceImlOnly: true };
  }
  return { ok: false };
}
