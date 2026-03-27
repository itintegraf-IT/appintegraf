import { ContractApprovalStatus } from "@/lib/contracts/workflow-status";

const labels: Record<string, string> = {
  [ContractApprovalStatus.DRAFT]: "Návrh",
  [ContractApprovalStatus.IN_APPROVAL]: "Schvalování",
  [ContractApprovalStatus.APPROVAL_COMPLETED]: "Schváleno",
  [ContractApprovalStatus.SIGNATURE_PENDING]: "K podpisu",
  [ContractApprovalStatus.SIGNED]: "Podepsáno",
  [ContractApprovalStatus.ARCHIVED]: "Archiv",
  [ContractApprovalStatus.REJECTED]: "Zamítnuto",
  [ContractApprovalStatus.RETURNED]: "Vráceno k úpravě",
};

export function contractStatusLabel(status: string): string {
  return labels[status] ?? status;
}
