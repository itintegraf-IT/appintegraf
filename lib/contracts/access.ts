/**
 * Autor, odpovědná osoba nebo administrátor – správa životního cyklu a příloh.
 */
export function canManageContractRecord(
  contract: { created_by: number; responsible_user_id: number | null },
  userId: number,
  isAdmin: boolean
): boolean {
  if (isAdmin) return true;
  if (contract.created_by === userId) return true;
  if (contract.responsible_user_id != null && contract.responsible_user_id === userId) {
    return true;
  }
  return false;
}

/** Nahrávání a mazání příloh (ne archivováno / nezamítnuto). */
export function canModifyAttachments(approvalStatus: string): boolean {
  return approvalStatus !== "rejected" && approvalStatus !== "archived";
}
