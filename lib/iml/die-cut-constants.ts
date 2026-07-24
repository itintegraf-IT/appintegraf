/** Fixní materiály u výseku: checkbox + hmotnost. */

export const DIE_CUT_MATERIALS = [
  { key: "eup_60", label: "EUP 60", enabledField: "mat_eup_60", weightField: "mat_eup_60_weight" },
  { key: "eup_50", label: "EUP 50", enabledField: "mat_eup_50", weightField: "mat_eup_50_weight" },
  { key: "eth_55", label: "ETH 55", enabledField: "mat_eth_55", weightField: "mat_eth_55_weight" },
  { key: "elr_70", label: "ELR 70", enabledField: "mat_elr_70", weightField: "mat_elr_70_weight" },
] as const;

export type DieCutMaterialKey = (typeof DIE_CUT_MATERIALS)[number]["key"];
