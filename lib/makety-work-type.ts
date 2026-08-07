export const MAKETY_WORK_TYPES = ["maketa", "grafika"] as const;
export type MaketyWorkType = (typeof MAKETY_WORK_TYPES)[number];

export function isMaketyWorkType(value: string): value is MaketyWorkType {
  return MAKETY_WORK_TYPES.includes(value as MaketyWorkType);
}

export function parseMaketyWorkType(raw: string, fallback: MaketyWorkType = "maketa"): MaketyWorkType {
  const v = raw.trim().toLowerCase();
  return isMaketyWorkType(v) ? v : fallback;
}

export function maketyWorkTypeLabel(type: MaketyWorkType): string {
  return type === "grafika" ? "Grafika" : "Maketa";
}

export function maketyAssigneeRoleLabel(type: MaketyWorkType): string {
  return type === "grafika" ? "Grafika" : "Výroba maket";
}

/** České tvary pro texty notifikací / e-mailů podle typu zakázky. */
export type MaketyWorkTypeWording = {
  /** Maketa / Grafika */
  label: string;
  /** maketa / grafika */
  nominative: string;
  /** makety / grafiky */
  genitive: string;
  /** maketu / grafiku */
  accusative: string;
  /** k maketě / ke grafice */
  toPrep: string;
  /** Otevřít maketu / Otevřít grafiku */
  openCta: string;
};

export function maketyWorkTypeWording(type: MaketyWorkType): MaketyWorkTypeWording {
  if (type === "grafika") {
    return {
      label: "Grafika",
      nominative: "grafika",
      genitive: "grafiky",
      accusative: "grafiku",
      toPrep: "ke grafice",
      openCta: "Otevřít grafiku",
    };
  }
  return {
    label: "Maketa",
    nominative: "maketa",
    genitive: "makety",
    accusative: "maketu",
    toPrep: "k maketě",
    openCta: "Otevřít maketu",
  };
}

export function normalizeMaketyWorkType(raw: string | null | undefined): MaketyWorkType {
  return raw === "grafika" ? "grafika" : "maketa";
}
