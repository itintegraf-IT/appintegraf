import * as fs from "fs";
import * as path from "path";
import { FIX_SETTINGS } from "../config/fix-settings";
import { pocetVyhozu } from "../utils/pocet-vyhozu";
import type { VarConfig } from "./types";
import type { GenerateResult } from "./types";

const TTF1 = "FONT_11";
const TTF2 = "FONT_12";
const PocHlav = 6;

export function createVnitro(
  adresa: string,
  job: "CD_Vnitro" | "CD_Validator",
  varConfig: VarConfig,
  pocetKS: number,
  cislovaniVypnuto = false
): GenerateResult {
  const fix = FIX_SETTINGS[job];
  if (!fix || fix.cisNaRoli === "x") {
    return { success: false, error: "Neplatná konfigurace pro " + job };
  }

  const PocetCnaRoli = fix.cisNaRoli as number;
  const CISLIC = fix.pocCislic;
  const { serie, prvniJizd, prod } = varConfig;

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

  for (let vyhoz = 1; vyhoz < pv; vyhoz++) {
    const CisloRole = cislovaniVypnuto ? 0 : prvniJizd + vyhoz - 1;

    for (let zc = 0; zc < 6; zc++) {
      let Row1 = "";
      for (let p = 0; p < PocHlav; p++) {
        Row1 += `NEPRODEJNE ;${serie[p]} ${CisloRole};`;
      }
      Row1 += `;${vyhoz};0;${TTF1}`;
      csvLines.push(Row1);
      txtLines.push(Row1);
    }

    for (let CisloJizd = 1; CisloJizd <= PocetCnaRoli; CisloJizd++) {
      const CisloRoleF = String(CisloRole).padStart(3, "0");
      const CisloJizdF = String(CisloJizd).padStart(4, "0");
      const Cislo = cislovaniVypnuto ? "000  " + CisloJizdF : CisloRoleF + "  " + CisloJizdF;

      let Row2 = "";
      for (let p = 0; p < PocHlav; p++) {
        Row2 += `${serie[p]}${Cislo};`;
      }
      Row2 += `;${vyhoz};${CisloRoleF};${TTF2}`;
      csvLines.push(Row2);
      txtLines.push(Row2);
    }

    for (let kc = 0; kc < 4; kc++) {
      let Row3 = "";
      for (let p = 0; p < PocHlav; p++) {
        Row3 += "NEPRODEJNE;";
      }
      Row3 += `;${vyhoz};0;${TTF1}`;
      csvLines.push(Row3);
      txtLines.push(Row3);
    }
  }

  const csvContent = csvLines.join("\n") + "\n";
  const txtContent = txtLines.join("\n") + "\n";

  fs.writeFileSync(csvPath, csvContent, "utf-8");
  fs.writeFileSync(txtPath, txtContent, "utf-8");

  return { success: true, csvPath, txtPath, pocetVyhozu: pv - 1 };
}
