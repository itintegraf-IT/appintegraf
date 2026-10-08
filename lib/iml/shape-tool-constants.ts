/** Konstanty tříúrovňového modelu tvar / nástroj / montáž. */

export const IML_SHAPE_TYPES = ["CUP", "LID", "WRAP", "OTHER"] as const;
export type ImlShapeType = (typeof IML_SHAPE_TYPES)[number];

export const IML_SHAPE_TYPE_LABELS: Record<ImlShapeType, string> = {
  CUP: "Vanička",
  LID: "Víčko",
  WRAP: "Obvodovka",
  OTHER: "Jiné",
};

export const IML_TOOL_TECHNOLOGIES = [
  "MONTEX",
  "PROTLACOVAK_ATLAS",
  "PROTLACOVAK_RUCNI",
  "PRIKLOP",
  "LOMBARDI",
] as const;
export type ImlToolTechnology = (typeof IML_TOOL_TECHNOLOGIES)[number];

export const IML_TOOL_TECHNOLOGY_LABELS: Record<ImlToolTechnology, string> = {
  MONTEX: "Montex",
  PROTLACOVAK_ATLAS: "Protlačovák Atlas",
  PROTLACOVAK_RUCNI: "Ruční protlačovák",
  PRIKLOP: "Příklop",
  LOMBARDI: "Lombardi",
};

/** Mapování volného textu legacy `primary_machine` → technology. */
export const LEGACY_MACHINE_TO_TECHNOLOGY: Record<string, ImlToolTechnology> = {
  montex: "MONTEX",
  atlas: "PROTLACOVAK_ATLAS",
  "protlačovák atlas": "PROTLACOVAK_ATLAS",
  protlacovak_atlas: "PROTLACOVAK_ATLAS",
  "ruční protlačovák": "PROTLACOVAK_RUCNI",
  rucni: "PROTLACOVAK_RUCNI",
  příklop: "PRIKLOP",
  priklop: "PRIKLOP",
  lombardi: "LOMBARDI",
};

export function mapLegacyMachineToTechnology(
  raw: string | null | undefined
): ImlToolTechnology | null {
  if (!raw?.trim()) return null;
  const key = raw.trim().toLocaleLowerCase("cs");
  if (key in LEGACY_MACHINE_TO_TECHNOLOGY) {
    return LEGACY_MACHINE_TO_TECHNOLOGY[key];
  }
  for (const [k, v] of Object.entries(LEGACY_MACHINE_TO_TECHNOLOGY)) {
    if (key.includes(k)) return v;
  }
  return null;
}

export const IML_TOOL_STATUSES = ["ACTIVE", "MAINTENANCE", "DECOMMISSIONED"] as const;
export type ImlToolStatus = (typeof IML_TOOL_STATUSES)[number];

export const IML_TOOL_STATUS_LABELS: Record<ImlToolStatus, string> = {
  ACTIVE: "Aktivní",
  MAINTENANCE: "Údržba",
  DECOMMISSIONED: "Vyřazený",
};

export const IML_SHAPE_TOOL_PRIORITIES = ["PRIMARY", "ALT_1", "ALT_2", "ALT_3"] as const;
export type ImlShapeToolPriority = (typeof IML_SHAPE_TOOL_PRIORITIES)[number];

export const IML_IMPOSITION_LAYOUT_TYPES = ["SOLO", "SET"] as const;
export type ImlImpositionLayoutType = (typeof IML_IMPOSITION_LAYOUT_TYPES)[number];

export function isImlShapeType(v: string): v is ImlShapeType {
  return (IML_SHAPE_TYPES as readonly string[]).includes(v);
}

export function isImlToolTechnology(v: string): v is ImlToolTechnology {
  return (IML_TOOL_TECHNOLOGIES as readonly string[]).includes(v);
}

export function isImlToolStatus(v: string): v is ImlToolStatus {
  return (IML_TOOL_STATUSES as readonly string[]).includes(v);
}

export function isImlShapeToolPriority(v: string): v is ImlShapeToolPriority {
  return (IML_SHAPE_TOOL_PRIORITIES as readonly string[]).includes(v);
}

export function isImlImpositionLayoutType(v: string): v is ImlImpositionLayoutType {
  return (IML_IMPOSITION_LAYOUT_TYPES as readonly string[]).includes(v);
}
