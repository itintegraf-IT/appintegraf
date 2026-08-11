/** Typ dat u zadání grafiky: nová data vs úprava stávajících. */
export const MAKETY_DATA_KINDS = ["nova_data", "uprava_dat"] as const;
export type MaketyDataKind = (typeof MAKETY_DATA_KINDS)[number];

export const DEFAULT_MAKETY_DATA_KIND: MaketyDataKind = "nova_data";

export function isMaketyDataKind(value: string): value is MaketyDataKind {
  return MAKETY_DATA_KINDS.includes(value as MaketyDataKind);
}

export function parseMaketyDataKind(
  raw: string | null | undefined,
  fallback: MaketyDataKind = DEFAULT_MAKETY_DATA_KIND
): MaketyDataKind {
  const v = String(raw ?? "")
    .trim()
    .toLowerCase();
  return isMaketyDataKind(v) ? v : fallback;
}

export function maketyDataKindLabel(kind: string): string {
  switch (kind) {
    case "uprava_dat":
      return "úprava dat";
    case "nova_data":
    default:
      return "nová data";
  }
}
