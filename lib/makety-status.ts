import {
  grafikaStatusBadgeClass,
  grafikaStatusLabel,
  isGrafikaOnlyStatus,
} from "@/lib/makety-grafika-status";
import type { MaketyWorkType } from "@/lib/makety-work-type";

export type MaketaStatus =
  | "awaiting_quote"
  | "quote_submitted"
  | "open"
  | "in_progress"
  | "data_problem"
  | "done"
  | "prepress_approved"
  | "sent_for_approval"
  | "approved"
  | "cancelled";

export type MaketaPriority = "normal" | "high" | "urgent";

/** Stavy zakázky ve frontě výroby (po schválení ceny). */
export const MAKETY_PRODUCTION_QUEUE_STATUSES = ["open", "in_progress"] as const;

export function maketaStatusLabel(status: string, workType?: MaketyWorkType): string {
  if (workType === "grafika" || isGrafikaOnlyStatus(status)) {
    return grafikaStatusLabel(status);
  }
  switch (status) {
    case "awaiting_quote":
      return "Čeká na kalkulaci";
    case "quote_submitted":
      return "Čeká na schválení";
    case "open":
      return "Schváleno / ve frontě";
    case "in_progress":
      return "Ve výrobě";
    case "done":
      return "Hotovo";
    case "cancelled":
      return "Zrušená";
    default:
      return status;
  }
}

export function maketaStatusBadgeClass(status: string, workType?: MaketyWorkType): string {
  if (workType === "grafika" || isGrafikaOnlyStatus(status)) {
    return grafikaStatusBadgeClass(status);
  }
  switch (status) {
    case "awaiting_quote":
      return "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-100";
    case "quote_submitted":
      return "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-100";
    case "done":
      return "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-100";
    case "in_progress":
      return "bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-100";
    case "cancelled":
      return "bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-200";
    case "open":
      return "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-100";
    default:
      return "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-200";
  }
}

export function maketaPriorityLabel(priority: string): string {
  switch (priority) {
    case "urgent":
      return "Urgentní";
    case "high":
      return "Vysoká";
    case "normal":
    default:
      return "Normální";
  }
}

export function maketaPriorityBadgeClass(priority: string): string {
  switch (priority) {
    case "urgent":
      return "bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-100";
    case "high":
      return "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-100";
    default:
      return "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-200";
  }
}

export function parseMaketaPriority(raw: string | null | undefined): MaketaPriority {
  const p = (raw ?? "normal").toLowerCase();
  if (p === "urgent" || p === "high") return p;
  return "normal";
}

/** Pořadí priority: urgent → high → normal (menší = dřív). */
export function prioritySortKey(priority: string): number {
  switch (priority) {
    case "urgent":
      return 0;
    case "high":
      return 1;
    default:
      return 2;
  }
}

export function isMaketaPreApprovalStatus(status: string): boolean {
  return status === "awaiting_quote" || status === "quote_submitted";
}

export {
  isMaketaTerminalStatus,
  isGrafikaImlArchived,
  maketyActiveWhereClause,
  maketyArchiveWhereClause,
} from "@/lib/makety-grafika-status";
