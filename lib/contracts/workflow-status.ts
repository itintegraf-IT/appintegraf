/**
 * Hodnoty sloupce contracts.approval_status (Evidence smluv).
 * @see docs/MODUL_EVIDENCE_SMLOUV.md
 */
export const ContractApprovalStatus = {
  DRAFT: "draft",
  IN_APPROVAL: "in_approval",
  APPROVAL_COMPLETED: "approval_completed",
  SIGNATURE_PENDING: "signature_pending",
  SIGNED: "signed",
  ARCHIVED: "archived",
  REJECTED: "rejected",
  RETURNED: "returned",
} as const;

export type ContractApprovalStatusValue =
  (typeof ContractApprovalStatus)[keyof typeof ContractApprovalStatus];
