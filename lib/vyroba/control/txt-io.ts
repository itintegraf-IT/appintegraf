/**
 * TXT export/import pro ruční opravy – kompatibilní s formátem IG52
 * Formát řádku: Ks|Serie|CisloDo|CisloOd
 * IGT: Ks|Serie|Predcisli_CisloDo|Predcisli_CisloOd
 */

import path from "path";
import fs from "fs/promises";

export type TxtRow = {
  ks: number;
  serie: string;
  predcisli?: string;
  cisloOd: string;
  cisloDo: string;
};

function parseCislo(s: string): number {
  return parseInt(String(s).replace(/\s/g, ""), 10) || 0;
}

/**
 * Parsuje řádek TXT ve formátu Ks|Serie|Do|Od nebo Ks|Serie|Pred_Do|Pred_Od
 * Ks v souboru = zbývá do plné krabice (ksVKr - ks). Pro import: ks = ksVKr - Ks.
 */
export function parseTxtLine(
  line: string,
  isIGT: boolean,
  ksVKr: number = 20
): TxtRow | null {
  const trimmed = line.trim();
  if (!trimmed || trimmed.split("|").length < 4) return null;

  const parts = trimmed.split("|").map((p) => p.trim());
  const remaining = parseInt(parts[0], 10) || 0;
  const ks = Math.max(0, ksVKr - remaining);
  const serie = parts[1] ?? "";
  const doPart = parts[2] ?? "";
  const odPart = parts[3] ?? "";

  let predcisli: string | undefined;
  let cisloDo: string;
  let cisloOd: string;

  if (isIGT && doPart.includes("_") && odPart.includes("_")) {
    const [p1, d1] = doPart.split("_");
    const [p2, o1] = odPart.split("_");
    predcisli = (p1 ?? p2 ?? "").trim();
    cisloDo = (d1 ?? doPart).replace(/\s/g, "");
    cisloOd = (o1 ?? odPart).replace(/\s/g, "");
  } else {
    cisloDo = doPart.replace(/\s/g, "");
    cisloOd = odPart.replace(/\s/g, "");
  }

  return { ks, serie, predcisli, cisloOd, cisloDo };
}

/**
 * Formátuje řádek pro zápis do TXT
 */
export function formatTxtRow(
  row: TxtRow,
  ksVKr: number,
  isIGT: boolean
): string {
  const ks = String(ksVKr - row.ks).padStart(2, "0");
  const doStr = isIGT && row.predcisli
    ? `${row.predcisli}_${row.cisloDo}`
    : row.cisloDo;
  const odStr = isIGT && row.predcisli
    ? `${row.predcisli}_${row.cisloOd}`
    : row.cisloOd;
  return `${ks}|${row.serie}|${doStr}|${odStr}\n`;
}

/**
 * Exportuje stav do TXT obsahu (pro stažení)
 */
export function exportToTxt(
  rows: TxtRow[],
  ksVKr: number,
  isIGT: boolean
): string {
  return rows.map((r) => formatTxtRow(r, ksVKr, isIGT)).join("");
}

/**
 * Parsuje TXT obsah a vrací řádky (pro import)
 * Formát: řádky s |, pro každou produkci bere poslední řádek v bloku
 */
export function importFromTxt(
  content: string,
  isIGT: boolean,
  ksVKr: number = 20,
  prod: number = 6
): TxtRow[] {
  const lines = content.split("\n").filter((l) => l.includes("|"));
  const rows: TxtRow[] = [];
  const perProd = Math.max(1, Math.floor(lines.length / prod));
  for (let k = 0; k < prod; k++) {
    const start = k * perProd;
    const prodLines = lines.slice(start, start + perProd);
    const lastLine = prodLines[prodLines.length - 1];
    if (lastLine) {
      const row = parseTxtLine(lastLine, isIGT, ksVKr);
      if (row) {
        row.ks = prodLines.length;
        rows.push(row);
      } else {
        rows.push({ ks: 0, serie: "", cisloOd: "", cisloDo: "" });
      }
    } else {
      rows.push({ ks: 0, serie: "", cisloOd: "", cisloDo: "" });
    }
  }
  return rows;
}

/**
 * Zapisuje rozpracované TXT soubory do ADRESA/REZANI/JOB/
 */
export async function writeTxtFiles(
  basePath: string,
  job: string,
  rows: TxtRow[],
  ksVKr: number,
  isIGT: boolean
): Promise<void> {
  const dir = path.join(basePath, "REZANI", job);
  await fs.mkdir(dir, { recursive: true });

  for (let k = 0; k < rows.length; k++) {
    const row = rows[k];
    const content = formatTxtRow(row, ksVKr, isIGT);
    const filePath = path.join(dir, `${k + 1}.txt`);
    await fs.writeFile(filePath, content, "utf-8");
  }
}

/**
 * Přidává řádek do rozpracovaného TXT souboru (append)
 */
export async function appendTxtRow(
  basePath: string,
  job: string,
  production: number,
  row: TxtRow,
  ksVKr: number,
  isIGT: boolean
): Promise<void> {
  const filePath = path.join(basePath, "REZANI", job, `${production}.txt`);
  const content = formatTxtRow(row, ksVKr, isIGT);
  await fs.appendFile(filePath, content, "utf-8");
}

/**
 * Čte rozpracované TXT soubory a vrací řádky
 */
export async function readTxtFiles(
  basePath: string,
  job: string,
  prod: number,
  isIGT: boolean
): Promise<TxtRow[]> {
  const dir = path.join(basePath, "REZANI", job);
  const rows: TxtRow[] = [];

  for (let k = 1; k <= prod; k++) {
    const filePath = path.join(dir, `${k}.txt`);
    try {
      const content = await fs.readFile(filePath, "utf-8");
      const lines = content.split("\n").filter((l) => l.includes("|"));
      const lastLine = lines[lines.length - 1];
      if (lastLine) {
        const parsed = parseTxtLine(lastLine, isIGT, 20);
        if (parsed) {
          parsed.ks = lines.length;
          rows.push(parsed);
        } else {
          rows.push({
            ks: lines.length,
            serie: "",
            cisloOd: "",
            cisloDo: "",
          });
        }
      } else {
        rows.push({ ks: 0, serie: "", cisloOd: "", cisloDo: "" });
      }
    } catch {
      rows.push({ ks: 0, serie: "", cisloOd: "", cisloDo: "" });
    }
  }
  return rows;
}
