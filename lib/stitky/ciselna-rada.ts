import { type LabelRowInput } from "@/lib/stitky/validators/order";

export type StitkyTemplateParams = {
  key: string;
  sheetKey: string;
  rowStart: number;
  rowStep: number;
  rowEnd: number;
  colStart: number;
  colStep: number;
  colEnd: number;
};

export type LabelCell = {
  text1: string;
  text2: string;
  text3: string;
  rangeLabel: string;
  pocetKs: string;
  zakazka: string;
  oriflameHeader?: string;
  totalUnitsLabel?: string;
  totalUnitsValue?: string;
  totalUnitsPcs?: string;
  barcodeData?: string;
};

export function calcLabelsPerPage(t: StitkyTemplateParams): number {
  const cols = Math.floor((t.colEnd - t.colStart) / t.colStep) + 1;
  const rows = Math.floor((t.rowEnd - t.rowStart) / t.rowStep) + 1;
  return cols * rows;
}

export function calcPageCount(row: LabelRowInput, template: StitkyTemplateParams): number {
  if (!row.quantity || !row.packSize) return 0;
  const totalLabels = Math.ceil(row.quantity / row.packSize);
  const labelsPerPage = calcLabelsPerPage(template);
  if (labelsPerPage <= 0) return 0;
  return Math.ceil(totalLabels / labelsPerPage);
}

/** Přepis S_900_Ciselna_rada */
export function generateLabels(
  row: LabelRowInput,
  template: StitkyTemplateParams,
  orderNumber: string,
  templateKey: string
): { pages: LabelCell[][]; totalPages: number } {
  const quantity = row.quantity!;
  const packSize = row.packSize!;
  const text1 = row.text1?.trim() ?? "";
  const text2 = row.text2?.trim() ?? "";
  const text3 = row.text3?.trim() ?? "";
  const prefix = row.prefix?.trim() ?? "";
  const rangeFrom = row.rangeFrom?.trim() ?? "";
  const rangeTo = row.rangeTo?.trim() ?? "";

  const { rowStart, rowStep, rowEnd, colStart, colStep, colEnd } = template;

  let od: number;
  let do_: number;
  let bezRady: boolean;

  if (!rangeFrom && !rangeTo) {
    od = 1;
    do_ = quantity;
    bezRady = true;
  } else {
    od = parseInt(rangeFrom, 10);
    do_ = parseInt(rangeTo, 10);
    bezRady = false;
  }

  const delka = Math.max(rangeFrom.length, rangeTo.length, 1);
  const pad = (n: number) => String(n).padStart(delka, "0");

  const pages: LabelCell[][] = [];
  let currentPage: LabelCell[] = [];
  let currentRow = rowStart;
  let currentCol = colStart;

  for (let rada = od; rada <= do_; rada += packSize) {
    if (currentCol > colEnd) {
      currentCol = colStart;
      currentRow += rowStep;
    }
    if (currentRow > rowEnd) {
      pages.push(currentPage);
      currentPage = [];
      currentRow = rowStart;
      currentCol = colStart;
    }

    const cisloP = pad(rada);
    const cisloK = pad(Math.min(rada + packSize - 1, do_));
    const rangeLabel = bezRady ? "" : `Řada: ${prefix} ${cisloP} - ${cisloK}`.trim();

    let cell: LabelCell;
    if (templateKey === "Oriflame") {
      cell = {
        text1,
        text2,
        text3: "",
        rangeLabel: "",
        pocetKs: "",
        zakazka: "",
        oriflameHeader: "Oriflame Cosmetics S.A.",
        totalUnitsLabel: "Total Units:",
        totalUnitsValue: String(packSize),
        totalUnitsPcs: "pcs",
        barcodeData: `(92)${text1}(37)${packSize}`,
      };
    } else {
      cell = {
        text1,
        text2,
        text3,
        rangeLabel,
        pocetKs: `${packSize} ks`,
        zakazka: orderNumber,
      };
    }

    currentPage.push(cell);
    currentCol += colStep;
  }

  if (currentPage.length > 0) {
    pages.push(currentPage);
  }

  return { pages, totalPages: pages.length };
}

export function getFileNames(orderNumber: string, templateKey: string) {
  const typeSuffix = templateKey ? `_${templateKey.replace(/\s+/g, "")}` : "";
  return {
    draft: `${orderNumber}_rozpracovane`,
    submitted: `${orderNumber}${typeSuffix}`,
    done: `${orderNumber}${typeSuffix}_hotovo`,
  };
}
