import { STITKY_STATUS_LABELS, type StitkyOrderStatus } from "@/lib/stitky/constants";

export function stitkyStatusLabel(status: string): string {
  return STITKY_STATUS_LABELS[status as StitkyOrderStatus] ?? status;
}

export function stitkyStatusBadgeClass(status: string): string {
  switch (status) {
    case "DRAFT":
      return "bg-gray-100 text-gray-700";
    case "SUBMITTED":
      return "bg-blue-100 text-blue-800";
    case "SUBMITTED_MISTRI":
      return "bg-indigo-100 text-indigo-800";
    case "PRINTED":
      return "bg-amber-100 text-amber-800";
    case "DONE":
      return "bg-green-100 text-green-800";
    default:
      return "bg-gray-100 text-gray-700";
  }
}

export function stitkyStatusHint(status: string): string | null {
  switch (status) {
    case "SUBMITTED":
    case "SUBMITTED_MISTRI":
      return "Čeká na zpracování tiskařem";
    case "PRINTED":
      return "Vytištěno, čeká na potvrzení „Zpracováno“";
    case "DONE":
      return "Zakázka byla zpracována";
    default:
      return null;
  }
}
