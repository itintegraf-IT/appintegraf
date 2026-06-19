import { PDFDocument, PDFPage, PDFFont, rgb, type PDFImage } from "pdf-lib";
import { setupPdfWithFonts } from "@/lib/vyroba/protocol/fonts";
import { type LabelCell, type StitkyTemplateParams } from "@/lib/stitky/ciselna-rada";
import { generateCode128Png } from "@/lib/stitky/barcode";
import {
  A4_HEIGHT_MM,
  A4_WIDTH_MM,
  getGridSpec,
  labelPositionMm,
} from "@/lib/stitky/label-layout";

const mm = (v: number) => v * 2.83465;

function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen - 1) + "…";
}

async function drawStandardLabel(
  page: PDFPage,
  cell: LabelCell,
  xMm: number,
  yTopMm: number,
  wMm: number,
  hMm: number,
  font: PDFFont,
  fontBold: PDFFont
) {
  const baseX = mm(xMm);
  const baseY = page.getHeight() - mm(yTopMm);
  let y = mm(4);

  page.drawText(truncate(cell.text1, 55), { x: baseX + mm(2), y: baseY - y, size: 8, font: fontBold });
  y += mm(4.5);
  page.drawText(truncate(cell.text2, 55), { x: baseX + mm(2), y: baseY - y, size: 7, font });
  y += mm(4);
  if (cell.text3) {
    page.drawText(truncate(cell.text3, 55), { x: baseX + mm(2), y: baseY - y, size: 7, font });
    y += mm(4);
  }
  if (cell.rangeLabel) {
    page.drawText(truncate(cell.rangeLabel, 50), {
      x: baseX + mm(2),
      y: baseY - y,
      size: 6.5,
      font,
      color: rgb(0.35, 0.35, 0.35),
    });
    y += mm(4);
  }
  page.drawText(`Počet: ${cell.pocetKs}`, { x: baseX + mm(2), y: baseY - mm(hMm - 6), size: 7, font });
  page.drawText(cell.zakazka, {
    x: baseX + mm(wMm - 22),
    y: baseY - mm(hMm - 6),
    size: 7,
    font,
  });

  page.drawRectangle({
    x: baseX,
    y: baseY - mm(hMm),
    width: mm(wMm),
    height: mm(hMm),
    borderColor: rgb(0.75, 0.75, 0.75),
    borderWidth: 0.3,
  });
}

async function drawOriflameLabel(
  page: PDFPage,
  cell: LabelCell,
  xMm: number,
  yTopMm: number,
  wMm: number,
  hMm: number,
  font: PDFFont,
  fontBold: PDFFont,
  doc: PDFDocument,
  barcodeCache: Map<string, PDFImage>
) {
  const baseX = mm(xMm);
  const baseY = page.getHeight() - mm(yTopMm);
  let y = mm(3);

  page.drawText(cell.oriflameHeader ?? "Oriflame Cosmetics S.A.", {
    x: baseX + mm(2),
    y: baseY - y,
    size: 7,
    font: fontBold,
  });
  y += mm(5);
  page.drawText(truncate(cell.text1, 40), { x: baseX + mm(2), y: baseY - y, size: 8, font: fontBold });
  y += mm(4.5);
  page.drawText(truncate(cell.text2, 45), { x: baseX + mm(2), y: baseY - y, size: 7, font });
  y += mm(5);
  page.drawText(cell.totalUnitsLabel ?? "Total Units:", { x: baseX + mm(2), y: baseY - y, size: 7, font });
  page.drawText(cell.totalUnitsValue ?? "", {
    x: baseX + mm(28),
    y: baseY - y,
    size: 8,
    font: fontBold,
  });
  page.drawText(cell.totalUnitsPcs ?? "pcs", { x: baseX + mm(40), y: baseY - y, size: 7, font });

  const barcodeData = cell.barcodeData ?? "";
  if (barcodeData) {
    let img = barcodeCache.get(barcodeData);
    if (!img) {
      const png = await generateCode128Png(barcodeData);
      img = await doc.embedPng(png);
      barcodeCache.set(barcodeData, img);
    }
    const barW = mm(wMm - 6);
    const barH = mm(10);
    page.drawImage(img, {
      x: baseX + mm(3),
      y: baseY - mm(hMm - 4) - barH,
      width: barW,
      height: barH,
    });
  }

  page.drawRectangle({
    x: baseX,
    y: baseY - mm(hMm),
    width: mm(wMm),
    height: mm(hMm),
    borderColor: rgb(0.75, 0.75, 0.75),
    borderWidth: 0.3,
  });
}

export async function buildLabelsPdf(params: {
  pages: LabelCell[][];
  componentKey: string;
  orderNumber: string;
  rowIndex: number;
}): Promise<Uint8Array> {
  const { doc, font, fontBold } = await setupPdfWithFonts();
  const spec = getGridSpec(params.componentKey);
  const barcodeCache = new Map<string, PDFImage>();

  for (const pageCells of params.pages) {
    const page = doc.addPage([mm(A4_WIDTH_MM), mm(A4_HEIGHT_MM)]);

    for (let i = 0; i < pageCells.length; i++) {
      const cell = pageCells[i];
      const pos = labelPositionMm(i, spec);

      if (params.componentKey === "oriflame") {
        await drawOriflameLabel(
          page,
          cell,
          pos.x,
          pos.y,
          spec.labelWidthMm,
          spec.labelHeightMm,
          font,
          fontBold,
          doc,
          barcodeCache
        );
      } else {
        await drawStandardLabel(
          page,
          cell,
          pos.x,
          pos.y,
          spec.labelWidthMm,
          spec.labelHeightMm,
          font,
          fontBold
        );
      }
    }
  }

  return doc.save();
}

export function pdfFilename(orderNumber: string, rowIndex: number): string {
  const safe = orderNumber.replace(/[^\w.-]+/g, "_");
  return `Arch_zakazka_${safe}_radek_${rowIndex}.pdf`;
}

export async function buildLabelsPdfForOrder(
  orderNumber: string,
  templateKey: string,
  componentKey: string,
  template: StitkyTemplateParams,
  labelRow: import("@/lib/stitky/validators/order").LabelRowInput,
  rowIndex: number
): Promise<{ bytes: Uint8Array; filename: string }> {
  const { generateLabels } = await import("@/lib/stitky/ciselna-rada");
  const { pages } = generateLabels(labelRow, template, orderNumber, templateKey);

  const bytes = await buildLabelsPdf({
    pages,
    componentKey,
    orderNumber,
    rowIndex,
  });

  return { bytes, filename: pdfFilename(orderNumber, rowIndex) };
}
