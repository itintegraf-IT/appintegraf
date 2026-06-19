/** Stavy zakázky štítků — ekvivalent workflow v XLSM. */
export const STITKY_ORDER_STATUSES = [
  "DRAFT",
  "SUBMITTED",
  "SUBMITTED_MISTRI",
  "PRINTED",
  "DONE",
] as const;

export type StitkyOrderStatus = (typeof STITKY_ORDER_STATUSES)[number];

export const STITKY_USER_ROLES = ["ZADAVATEL", "MISTER", "TISKAR"] as const;

export type StitkyUserRole = (typeof STITKY_USER_ROLES)[number];

export const STITKY_STATUS_LABELS: Record<StitkyOrderStatus, string> = {
  DRAFT: "Rozpracované",
  SUBMITTED: "Zadáno pro mailing",
  SUBMITTED_MISTRI: "Zadáno pro mistry",
  PRINTED: "Vytištěno",
  DONE: "Hotovo",
};

export const MAX_LABEL_ROWS = 5;

export function isStitkyTemplateReady(layoutStatus: string): boolean {
  return layoutStatus === "ready";
}
