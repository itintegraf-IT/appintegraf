import * as XLSX from "xlsx";
import { readFileSync } from "fs";
import {
  emptyBlock,
  type PaletovkaBlockData,
  type PaletovkaDocumentData,
  type PaletovkaLayoutJson,
  type PaletovkaLayoutVariant,
} from "@/lib/stitky/paletovky/types";

const LABEL_ZADAVATEL = "ZADAVATEL";
const LABEL_ZAKAZKA = "ZAKÁZKA";
const ORDER_LABELS = ["č.z.", "číslo zak.", "Číslo zakázky", "číslo zakázky"];
const NAKLAD_LABELS = ["Náklad", "Celkem"];
const UNIT_LABELS = ["Paleta", "Krabice"];

type CellAddr = { r: number; c: number };

function cellValue(ws: XLSX.WorkSheet, r: number, c: number): string {
  const addr = XLSX.utils.encode_cell({ r, c });
  const cell = ws[addr];
  if (!cell || cell.v == null) return "";
  return String(cell.v).trim();
}

function mergeTopLeft(ws: XLSX.WorkSheet, r: number, c: number): CellAddr {
  const merges = ws["!merges"] ?? [];
  for (const m of merges) {
    if (r >= m.s.r && r <= m.e.r && c >= m.s.c && c <= m.e.c) {
      return { r: m.s.r, c: m.s.c };
    }
  }
  return { r, c };
}

function mergedText(ws: XLSX.WorkSheet, r: number, c: number): string {
  const tl = mergeTopLeft(ws, r, c);
  return cellValue(ws, tl.r, tl.c);
}

function findLabelCells(ws: XLSX.WorkSheet, label: string): CellAddr[] {
  const ref = ws["!ref"];
  if (!ref) return [];
  const range = XLSX.utils.decode_range(ref);
  const out: CellAddr[] = [];
  for (let r = range.s.r; r <= range.e.r; r++) {
    for (let c = range.s.c; c <= range.e.c; c++) {
      const tl = mergeTopLeft(ws, r, c);
      if (tl.r !== r || tl.c !== c) continue;
      if (cellValue(ws, r, c) === label) out.push({ r, c });
    }
  }
  return out;
}

function valueRightOfLabel(ws: XLSX.WorkSheet, labelRow: number, labelCol: number): string {
  const merges = ws["!merges"] ?? [];
  for (const m of merges) {
    if (m.s.r === labelRow && m.s.c === labelCol && m.s.c <= 2) {
      const valueMerge = merges.find(
        (vm) => vm.s.r === m.s.r && vm.s.c >= 3 && vm.e.r === m.e.r
      );
      if (valueMerge) {
        return mergedText(ws, valueMerge.s.r, valueMerge.s.c);
      }
      return cellValue(ws, labelRow, labelCol + 3);
    }
  }
  return cellValue(ws, labelRow, labelCol + 3);
}

function detectVariant(zadavatelCells: CellAddr[]): PaletovkaLayoutVariant {
  if (zadavatelCells.length <= 1) return "single";
  const cols = zadavatelCells.map((c) => c.c);
  const hasDualColumn = cols.some((c) => c >= 10) && cols.some((c) => c < 5);
  if (hasDualColumn) return "dual_horizontal";
  return "stacked";
}

function parseBlockAt(ws: XLSX.WorkSheet, anchor: CellAddr): PaletovkaBlockData {
  const block = emptyBlock();
  const { r: startRow, c: startCol } = anchor;
  const ref = ws["!ref"];
  if (!ref) return block;

  const range = XLSX.utils.decode_range(ref);
  const maxRow = Math.min(range.e.r, startRow + 22);

  for (let r = startRow; r <= maxRow; r++) {
    for (let c = startCol; c <= startCol + 2; c++) {
      const tl = mergeTopLeft(ws, r, c);
      if (tl.r !== r || tl.c !== c) continue;
      const label = cellValue(ws, r, c);
      if (!label) continue;

      if (label === LABEL_ZADAVATEL) {
        block.zadavatel = valueRightOfLabel(ws, tl.r, tl.c);
      } else if (label === LABEL_ZAKAZKA) {
        block.zakazka = valueRightOfLabel(ws, tl.r, tl.c);
      } else if (ORDER_LABELS.includes(label)) {
        block.cisloZakazky = valueRightOfLabel(ws, tl.r, tl.c);
      } else if (label === "Druh:") {
        block.druh = valueRightOfLabel(ws, tl.r, tl.c);
      } else if (label === "Určeno pro:") {
        block.urcenoPro = valueRightOfLabel(ws, tl.r, tl.c);
      } else if (NAKLAD_LABELS.includes(label)) {
        block.nakladLabel = label as "Náklad" | "Celkem";
        block.baleniPopis = valueRightOfLabel(ws, tl.r, tl.c);
        const unitCol = startCol + 7;
        const unitLabel = mergedText(ws, r, unitCol);
        if (UNIT_LABELS.includes(unitLabel)) {
          block.jednotkaLabel = unitLabel as "Paleta" | "Krabice";
        }
      }
    }
  }

  const extraLines: string[] = [];
  const radky: PaletovkaBlockData["radky"] = [];

  for (let r = startRow; r <= maxRow; r++) {
    const colA = mergedText(ws, r, startCol);
    const colD = mergedText(ws, r, startCol + 3);
    const colH = mergedText(ws, r, startCol + 7);

    if (
      colA &&
      ![
        LABEL_ZADAVATEL,
        LABEL_ZAKAZKA,
        ...ORDER_LABELS,
        "Druh:",
        "Určeno pro:",
        ...NAKLAD_LABELS,
      ].includes(colA) &&
      !colA.startsWith("Na paletě")
    ) {
      const looksLikeQty = /[\d]/.test(colA) && (colA.includes("ks") || colA.includes("ta") || /^\d/.test(colA));
      if (looksLikeQty) {
        radky.push({ mnozstvi: colA, popis: colD, cislo: colH });
      }
    }

    if (colD && colD.startsWith("Na paletě")) {
      radky.push({ mnozstvi: colA, popis: colD, cislo: colH });
    }

    if (
      r > startRow + 6 &&
      colD &&
      !ORDER_LABELS.includes(colA) &&
      colA !== LABEL_ZADAVATEL &&
      colA !== LABEL_ZAKAZKA &&
      !NAKLAD_LABELS.includes(colA) &&
      !colD.startsWith("Na paletě") &&
      !/^\d/.test(colA) &&
      colA.length > 2 &&
      !radky.some((x) => x.popis === colD)
    ) {
      if (!block.cisloZakazky || colD !== block.zadavatel) {
        extraLines.push(colD);
      }
    }
  }

  if (radky.length === 0) {
    radky.push({ mnozstvi: "", popis: "", cislo: "" });
  }

  block.radky = radky;
  if (extraLines.length > 0) block.extraLines = [...new Set(extraLines)];

  return block;
}

function buildLayoutJson(
  variant: PaletovkaLayoutVariant,
  anchors: CellAddr[]
): PaletovkaLayoutJson {
  const blockWidth = variant === "dual_horizontal" ? 95 : 180;
  const blockHeight = variant === "stacked" ? 70 : 75;
  const gap = variant === "dual_horizontal" ? 8 : 6;

  const blocks = anchors.map((anchor, i) => {
    let xMm = 15;
    let yMm = 15;
    if (variant === "dual_horizontal") {
      xMm = i === 0 ? 10 : 110;
      yMm = 15;
    } else if (variant === "stacked") {
      xMm = 15;
      yMm = 15 + i * (blockHeight + gap);
    }
    return {
      originCol: anchor.c,
      originRow: anchor.r,
      regions: [
        { key: "frame", xMm, yMm, wMm: blockWidth, hMm: blockHeight },
      ],
    };
  });

  return {
    variant,
    blocks,
    pageWidthMm: 210,
    pageHeightMm: 297,
  };
}

export type XlsImportResult = {
  name: string;
  layoutVariant: PaletovkaLayoutVariant;
  blocksPerPage: number;
  layoutJson: PaletovkaLayoutJson;
  defaults: PaletovkaDocumentData;
  warnings: string[];
};

export function parsePaletovkaXlsBuffer(buffer: Buffer, filename: string): XlsImportResult {
  const wb = XLSX.read(buffer, { type: "buffer", cellStyles: true });
  const sheetName = wb.SheetNames[0];
  const ws = wb.Sheets[sheetName];
  const warnings: string[] = [];

  const zadavatelCells = findLabelCells(ws, LABEL_ZADAVATEL);
  if (zadavatelCells.length === 0) {
    throw new Error("V souboru nebyl nalezen blok ZADAVATEL");
  }

  const layoutVariant = detectVariant(zadavatelCells);
  const blocks = zadavatelCells.map((anchor) => parseBlockAt(ws, anchor));

  if (blocks.some((b) => !b.zadavatel && !b.zakazka)) {
    warnings.push("Některé bloky nemají vyplněného zadavatele ani zakázku");
  }

  const baseName = filename.replace(/\.(xls|xlsx)$/i, "").trim();

  return {
    name: baseName,
    layoutVariant,
    blocksPerPage: blocks.length,
    layoutJson: buildLayoutJson(layoutVariant, zadavatelCells),
    defaults: { blocks },
    warnings,
  };
}

export function parsePaletovkaXlsFile(path: string): XlsImportResult {
  const buffer = readFileSync(path);
  const filename = path.split(/[/\\]/).pop() ?? "template.xls";
  return parsePaletovkaXlsBuffer(buffer, filename);
}
