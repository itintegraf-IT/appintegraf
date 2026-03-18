import * as fs from "fs";
import * as path from "path";
import { FIX_SETTINGS } from "../config/fix-settings";
import type { VarConfig } from "./types";
import type { GenerateResult } from "./types";

const PocHlav = 6;

export function createIGT_Sazka(
  adresa: string,
  job: "IGT_Sazka",
  varConfig: VarConfig,
  pocetPredcisli: number
): GenerateResult {
  const fix = FIX_SETTINGS[job];
  if (!fix) return { success: false, error: "Neplatná konfigurace pro " + job };

  const { serie, prod, predcisli } = varConfig;

  if (!predcisli || predcisli.length < PocHlav) {
    return { success: false, error: "IGT_Sazka vyžaduje 6 předčíslí (PredcisliL)" };
  }

  const A = Math.floor(pocetPredcisli / prod);
  const B = pocetPredcisli / prod;
  if (Math.abs(A - B) > 1e-9) {
    return {
      success: false,
      error: "Počet předčíslí musí být dělitelný počet produkcí (" + prod + ") beze zbytku",
    };
  }

  const Cykl6 = Math.max(1, Math.floor(A / 10));
  const SerieS = serie.join(",");

  const outDir = path.join(adresa, "TISK", job);
  const baseName = `${job}_${SerieS}_${varConfig.prvniJizd}_${pocetPredcisli}`;
  const txtPath = path.join(outDir, `${baseName}.txt`);

  try {
    fs.mkdirSync(outDir, { recursive: true });
  } catch {
    return { success: false, error: "Nelze vytvořit adresář: " + outDir };
  }

  const txtLines: string[] = [];
  let Predcisli3 = 0;

  for (let s = 0; s < Cykl6; s++) {
    for (let r = 0; r < 10; r++) {
      const maxPorad = 3283;
      let lastPredcisli2 = 0;
      for (let PoradCislo = 1; PoradCislo <= maxPorad; PoradCislo++) {
        let Row2 = "";
        for (let p = 0; p < PocHlav; p++) {
          const Predcisli2 = Predcisli3 + parseInt(predcisli[p], 10) + r;
          lastPredcisli2 = Predcisli2;
          const Predcisli2F = String(Predcisli2).padStart(3, "0");
          if (Predcisli2F.length > 3) {
            return { success: false, error: "Předčíslí je větší než 999" };
          }
          const PoradCisloF = String(PoradCislo).padStart(6, "0");
          Row2 += `${serie[p]}_${Predcisli2F}_${PoradCisloF}|`;
        }
        txtLines.push(Row2);
      }
      Predcisli3 = lastPredcisli2 + 1;
    }
  }

  const txtContent = txtLines.join("\n") + "\n";
  fs.writeFileSync(txtPath, txtContent, "utf-8");

  return { success: true, txtPath, pocetVyhozu: A };
}
