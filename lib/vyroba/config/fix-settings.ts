/**
 * Fixní parametry tiskáren podle dokumentace IG52 (FixSettings.xml)
 */

export interface FixJobConfig {
  cisNaRoli: number | "x";
  pocCislic: number;
  pocetHlav: number;
}

export const FIX_SETTINGS: Record<string, FixJobConfig> = {
  CD_POP: { cisNaRoli: "x", pocCislic: 6, pocetHlav: 6 },
  CD_POP_NEXGO: { cisNaRoli: 160, pocCislic: 6, pocetHlav: 8 },
  CD_Vnitro: { cisNaRoli: 1000, pocCislic: 7, pocetHlav: 6 },
  CD_Validator: { cisNaRoli: 500, pocCislic: 7, pocetHlav: 6 },
  DPB_AVJ: { cisNaRoli: 3600, pocCislic: 5, pocetHlav: 6 },
  IGT_Sazka: { cisNaRoli: 3283, pocCislic: 6, pocetHlav: 6 },
};

export const JOB_TYPES = Object.keys(FIX_SETTINGS) as (keyof typeof FIX_SETTINGS)[];

export const JOB_LABELS: Record<string, string> = {
  CD_POP: "Jízdní doklady POP",
  CD_POP_NEXGO: "Jízdní doklady NEXGO",
  CD_Vnitro: "Vnitřní jízdenky ČD",
  CD_Validator: "Validační jízdenky",
  DPB_AVJ: "Kotouče",
  IGT_Sazka: "Stírací losy Sazka",
};
