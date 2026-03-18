import * as fs from "fs";
import * as path from "path";
import { FIX_SETTINGS } from "../config/fix-settings";
import { pocetVyhozu } from "../utils/pocet-vyhozu";
import type { VarConfig } from "./types";
import type { GenerateResult } from "./types";

const TTF1 = "FONT_11";
const TTF2 = "FONT_12";

export function createPOP(
  adresa: string,
  job: "CD_POP",
  varConfig: VarConfig,
  pocetKS: number
): GenerateResult {
  const fix = FIX_SETTINGS[job];
  if (!fix) return { success: false, error: "Neplatná konfigurace pro " + job };

  const CISLIC = fix.pocCislic;
  const { serie, pocetCnaRoli, prvniJizd, prod } = varConfig;
  const PrvniRole = Math.floor(prvniJizd / pocetCnaRoli);

  const pv = pocetVyhozu(pocetKS, prod);
  const SerieS = serie.join(",");

  const outDir = path.join(adresa, "TISK", job);
  const baseName = `${job}_${SerieS}_${prvniJizd}_${pocetKS}`;
  const csvPath = path.join(outDir, `${baseName}.csv`);
  const txtPath = path.join(outDir, `${baseName}.txt`);

  try {
    fs.mkdirSync(outDir, { recursive: true });
  } catch {
    return { success: false, error: "Nelze vytvořit adresář: " + outDir };
  }

  const csvLines: string[] = [];
  const txtLines: string[] = [];

  for (let vyhoz = 1; vyhoz <= pv; vyhoz++) {
    const Cislo0Jizd = prvniJizd + (vyhoz - 1) * pocetCnaRoli;

    for (let zc = 0; zc < 1; zc++) {
      let Row1 = "";
      for (let p = 0; p < serie.length; p++) {
        Row1 += `${serie[p]};`;
      }
      Row1 += `;${vyhoz};0;${TTF1};${Math.floor(PrvniRole) + vyhoz}_${(Math.floor(PrvniRole) + vyhoz) * serie.length}`;
      csvLines.push(Row1);
      txtLines.push(Row1);
    }

    for (let c1 = 0; c1 < pocetCnaRoli; c1++) {
      const c3 = String(Cislo0Jizd + c1).padStart(CISLIC + 2, "0");
      let Row2 = "";
      for (let p = 0; p < serie.length; p++) {
        Row2 += `${serie[p]} ${c3};`;
      }
      Row2 += `;${vyhoz};${c1 + 1};${TTF2}`;
      csvLines.push(Row2);
      txtLines.push(Row2);
    }
  }

  const csvContent = csvLines.join("\n") + "\n";
  const txtContent = txtLines.join("\n") + "\n";

  fs.writeFileSync(csvPath, csvContent, "utf-8");
  fs.writeFileSync(txtPath, txtContent, "utf-8");

  return { success: true, csvPath, txtPath, pocetVyhozu: pv };
}
