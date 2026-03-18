import * as fs from "fs";
import * as path from "path";
import { FIX_SETTINGS } from "../config/fix-settings";
import { pocetVyhozu } from "../utils/pocet-vyhozu";
import type { VarConfig } from "./types";
import type { GenerateResult } from "./types";

const TTF1 = "FONT_11";
const TTF2 = "FONT_12";

export function createDPB_AVJ(
  adresa: string,
  job: "DPB_AVJ",
  varConfig: VarConfig,
  pocetKS: number
): GenerateResult {
  const fix = FIX_SETTINGS[job];
  if (!fix || fix.cisNaRoli === "x") {
    return { success: false, error: "Neplatná konfigurace pro " + job };
  }

  const PocetCnaRoli = fix.cisNaRoli as number;
  const CISLIC = fix.pocCislic;
  const { serie, prvniRole, prod, skip } = varConfig;

  if (skip == null || skip === 0) {
    return { success: false, error: "DPB_AVJ vyžaduje parametr Skip" };
  }

  const pv = pocetVyhozu(pocetKS, prod);
  const SkipPocitany = pocetKS / prod;
  const ratio = Math.abs(SkipPocitany / skip);
  if (ratio < 0.9 || ratio > 1.1) {
    return {
      success: false,
      error: `Skip kontrola selhala: zadaný ${skip}, vypočtený ${SkipPocitany.toFixed(1)}`,
    };
  }

  const SerieS = serie.join(",");

  const outDir = path.join(adresa, "TISK", job);
  const baseName = `${job}_${SerieS}_${prvniRole}_${pocetKS}`;
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
    for (let i = 0; i < 14; i++) {
      let Row1 = "";
      for (let p = 0; p < serie.length; p++) {
        const b3 = String(p * skip + (prvniRole - 1) + vyhoz).padStart(4, "0");
        Row1 += `NEPREDAJNE ${b3};`;
      }
      Row1 += `;${vyhoz};0;${TTF1};${prvniRole + vyhoz}_${(prvniRole + vyhoz) * serie.length}`;
      csvLines.push(Row1);
      txtLines.push(Row1 + ";".repeat(6));
    }

    for (let c1 = 0; c1 < PocetCnaRoli; c1++) {
      const c3 = String(c1 + 1).padStart(CISLIC, "0");
      let Row2 = "";
      let Row3 = "";
      for (let p = 0; p < serie.length; p++) {
        const b3 = String(p * skip + (prvniRole - 1) + vyhoz).padStart(4, "0");
        Row2 += `${b3}/${c3};`;

        const mod1 = (b3 + c3).split("").reverse().join("");
        const mod2 = parseInt(b3, 10) + parseInt(c3, 10);
        const mod3 = Math.floor(parseInt(mod1, 10) / mod2);
        const modulo = String(mod3).slice(-1);
        Row3 += p + 1 < serie.length ? modulo + ";" : modulo;
      }
      Row2 += `;${vyhoz};${c1 + 1};${TTF2};;${Row3}`;
      csvLines.push(Row2);
      txtLines.push(Row2);
    }
  }

  for (let i = 0; i < 300; i++) {
    let Row4 = "";
    for (let p = 0; p < serie.length; p++) {
      Row4 += "ZACATEK;";
    }
    csvLines.push(Row4);
    txtLines.push(Row4 + ";".repeat(6));
  }

  const csvContent = csvLines.join("\n") + "\n";
  const txtContent = txtLines.join("\n") + "\n";

  fs.writeFileSync(csvPath, csvContent, "utf-8");
  fs.writeFileSync(txtPath, txtContent, "utf-8");

  return { success: true, csvPath, txtPath, pocetVyhozu: pv };
}
