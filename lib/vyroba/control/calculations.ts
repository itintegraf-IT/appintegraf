/**
 * Výpočty pro kontrolu balení podle IG52 (Kontrola_*.py)
 */

import { deleni3 } from "../utils/deleni3";
import { FIX_SETTINGS } from "../config/fix-settings";

export function formatCislo(val: number, pocCislic: number): string {
  const s = String(val).padStart(pocCislic, "0");
  return deleni3(s);
}

/**
 * KoncCisloRole = CisloRole - CiselNaRoli + 1
 * (poslední číslo na roli)
 */
export function koncCisloRole(cisloOd: number, ciselNaRoli: number): number {
  return cisloOd - ciselNaRoli + 1;
}

/**
 * Posun čísel pro IGT_Sazka: ±1, ±10, ±100, ±1000
 * Zpět = vyšší čísla (CisloOd + step)
 * Vpřed = nižší čísla (CisloOd - step)
 */
export function posunIGT(
  cisloOd: number,
  cisloDo: number,
  direction: "zpet" | "vpred",
  step: number
): { cisloOd: number; cisloDo: number } {
  const delta = direction === "zpet" ? step : -step;
  return {
    cisloOd: cisloOd + delta,
    cisloDo: cisloDo + delta,
  };
}

/**
 * Posun pro CD_* (Kontrola_9): Skip = CiselNaRoli × PROD
 * Zpět: CisloRole + Skip
 * Vpřed: CisloRole - Skip
 */
export function posunCD(
  cisloOd: number,
  cisloDo: number,
  ciselNaRoli: number,
  prod: number,
  direction: "zpet" | "vpred"
): { cisloOd: number; cisloDo: number } {
  const skip = ciselNaRoli * prod;
  const delta = direction === "zpet" ? skip : -skip;
  return {
    cisloOd: cisloOd + delta,
    cisloDo: cisloDo + delta,
  };
}

/**
 * Iniciální CisloOd a CisloDo pro první roli
 * PrvniJizd = CisloJizd - 1 (první nový kus)
 * CisloDo = PrvniJizd - CiselNaRoli (poslední na roli)
 */
export function initialCisla(
  prvniJizd: number,
  ciselNaRoli: number,
  pocCislic: number
): { cisloOd: string; cisloDo: string } {
  const cisloOd = prvniJizd;
  const cisloDo = prvniJizd - ciselNaRoli;
  return {
    cisloOd: formatCislo(cisloOd, pocCislic),
    cisloDo: formatCislo(cisloDo, pocCislic),
  };
}

/**
 * Iniciální řádky pro grid podle typu JOB (Kontrola_9, Kontrola_IGT_Sazka, Kontrola_NEXGO)
 * CD_POP: všechny produkce stejné číslo
 * CD_Vnitro, CD_Validator, CD_POP_NEXGO: stejné
 * DPB_AVJ: PrvniJizd2 = CisloJizd - Skip*((PROD-1)-k) - 1
 * IGT_Sazka: predcisli, Od-Do
 */
export function initialRowsForJob(
  job: string,
  prvniJizd: number,
  ciselNaRoli: number,
  prod: number,
  skip: number,
  pocCislic: number
): Array<{ cisloOd: string; cisloDo: string }> {
  const cisloJizd = prvniJizd + 1;

  if (job === "DPB_AVJ" && skip > 0) {
    return Array.from({ length: prod }, (_, k) => {
      const prvniJizd2 = Math.max(0, cisloJizd - skip * ((prod - 1) - k) - 1);
      const cisloOd = prvniJizd2;
      const cisloDo = prvniJizd2 - ciselNaRoli;
      return {
        cisloOd: formatCislo(cisloOd, pocCislic),
        cisloDo: formatCislo(cisloDo, pocCislic),
      };
    });
  }

  const { cisloOd, cisloDo } = initialCisla(prvniJizd, ciselNaRoli, pocCislic);
  return Array.from({ length: prod }, () => ({ cisloOd, cisloDo }));
}

export function getCiselNaRoli(job: string, pocetCnaRoli: number | null): number {
  const fix = FIX_SETTINGS[job];
  if (!fix) return 0;
  if (fix.cisNaRoli === "x") {
    return pocetCnaRoli ?? 180;
  }
  return fix.cisNaRoli;
}
