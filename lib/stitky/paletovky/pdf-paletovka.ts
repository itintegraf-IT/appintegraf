import { PDFDocument, type PDFFont, type PDFPage, rgb } from "pdf-lib";
import { setupPdfWithFonts } from "@/lib/vyroba/protocol/fonts";
import {
  type PaletovkaBlockData,
  type PaletovkaDocumentData,
  type PaletovkaLayoutJson,
  type PaletovkaLayoutVariant,
} from "@/lib/stitky/paletovky/types";

const mm = (v: number) => v * 2.83465;

function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen - 1) + "…";
}

function blockOrigin(
  variant: PaletovkaLayoutVariant,
  index: number,
  layout?: PaletovkaLayoutJson
): { x: number; y: number; w: number; h: number } {
  const region = layout?.blocks[index]?.regions.find((r) => r.key === "frame");
  if (region) {
    return { x: region.xMm, y: region.yMm, w: region.wMm, h: region.hMm };
  }
  if (variant === "dual_horizontal") {
    return { x: index === 0 ? 10 : 110, y: 15, w: 95, h: 75 };
  }
  if (variant === "stacked") {
    return { x: 15, y: 15 + index * 76, w: 180, h: 70 };
  }
  return { x: 15, y: 15, w: 180, h: 75 };
}

function drawBlock(
  page: PDFPage,
  block: PaletovkaBlockData,
  xMm: number,
  yMm: number,
  wMm: number,
  hMm: number,
  font: PDFFont,
  fontBold: PDFFont
) {
  const pageH = page.getHeight();
  const x = mm(xMm);
  const yTop = pageH - mm(yMm);
  const w = mm(wMm);
  const h = mm(hMm);

  page.drawRectangle({
    x,
    y: yTop - h,
    width: w,
    height: h,
    borderColor: rgb(0, 0, 0),
    borderWidth: 0.8,
  });

  let y = mm(5);
  const lineH = mm(5);
  const labelW = mm(22);
  const pad = mm(2);

  const drawRow = (label: string, value: string, bold = false) => {
    page.drawText(label, {
      x: x + pad,
      y: yTop - y,
      size: 8,
      font: fontBold,
    });
    page.drawText(truncate(value, 55), {
      x: x + labelW,
      y: yTop - y,
      size: 8,
      font: bold ? fontBold : font,
    });
    y += lineH;
  };

  drawRow("ZADAVATEL", block.zadavatel);
  y += mm(1);
  drawRow("ZAKÁZKA", block.zakazka);
  y += mm(1);
  drawRow("č.z.", block.cisloZakazky);

  if (block.druh) drawRow("Druh:", block.druh);
  if (block.urcenoPro) drawRow("Určeno pro:", block.urcenoPro);
  for (const line of block.extraLines ?? []) {
    drawRow("", line);
  }

  y += mm(1);
  drawRow(block.nakladLabel, block.baleniPopis);
  page.drawText(block.jednotkaLabel, {
    x: x + w - mm(22),
    y: yTop - y + lineH - mm(5),
    size: 8,
    font: fontBold,
  });
  y += lineH + mm(2);

  for (const row of block.radky) {
    if (!row.mnozstvi && !row.popis && !row.cislo) continue;
    page.drawText(truncate(row.mnozstvi, 18), {
      x: x + pad,
      y: yTop - y,
      size: 8,
      font: fontBold,
    });
    page.drawText(truncate(row.popis, 35), {
      x: x + mm(28),
      y: yTop - y,
      size: 7.5,
      font,
    });
    page.drawText(truncate(row.cislo, 8), {
      x: x + w - mm(12),
      y: yTop - y,
      size: 8,
      font,
    });
    y += lineH;
  }
}

export async function buildPaletovkaPdf(
  data: PaletovkaDocumentData,
  layoutVariant: PaletovkaLayoutVariant,
  layoutJson?: PaletovkaLayoutJson | null
): Promise<Uint8Array> {
  const { doc, font, fontBold } = await setupPdfWithFonts();
  const page = doc.addPage([mm(210), mm(297)]);

  data.blocks.forEach((block, i) => {
    const { x, y, w, h } = blockOrigin(layoutVariant, i, layoutJson ?? undefined);
    drawBlock(page, block, x, y, w, h, font, fontBold);
  });

  return doc.save();
}

export function paletovkaPdfFilename(title: string, id: number): string {
  const safe = title.replace(/[^\w.-]+/g, "_").slice(0, 60);
  return `paletovka_${safe}_${id}.pdf`;
}
