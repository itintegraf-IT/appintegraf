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
