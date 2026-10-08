/** Fixní materiály u výseku: checkbox + hmotnost. */

export const DIE_CUT_MATERIALS = [
  {
    key: "eup_60",
    label: "EUP 60",
    /** Kód pro `iml_shape_material_packaging.material_code` */
    packagingCode: "EUP60",
    enabledField: "mat_eup_60",
    weightField: "mat_eup_60_weight",
  },
  {
    key: "eup_50",
    label: "EUP 50",
    packagingCode: "EUP50",
    enabledField: "mat_eup_50",
    weightField: "mat_eup_50_weight",
  },
  {
    key: "eth_55",
    label: "ETH 55",
    packagingCode: "ETH55",
    enabledField: "mat_eth_55",
    weightField: "mat_eth_55_weight",
  },
  {
    key: "elr_70",
    label: "ELR 70",
    packagingCode: "ELR70",
    enabledField: "mat_elr_70",
    weightField: "mat_elr_70_weight",
  },
] as const;

export type DieCutMaterialKey = (typeof DIE_CUT_MATERIALS)[number]["key"];

/** Číselník materiálů pro materiálovou matici tvaru. */
export const SHAPE_PACKAGING_MATERIALS = DIE_CUT_MATERIALS.map((m) => ({
  code: m.packagingCode,
  label: m.label,
}));

export function shapePackagingMaterialLabel(code: string): string {
  const found = SHAPE_PACKAGING_MATERIALS.find(
    (m) => m.code.toUpperCase() === code.trim().toUpperCase()
  );
  return found?.label ?? code;
}
