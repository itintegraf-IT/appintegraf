import { rgb, type PDFFont, type PDFImage, type PDFPage } from "pdf-lib";
import { setupPdfWithFonts } from "@/lib/vyroba/protocol/fonts";
import {
  A4_HEIGHT_MM,
  A4_WIDTH_MM,
  labelContentBox,
  mmToPt,
  planLabelSheets,
  type EquipmentLabelGridSpec,
  type MmBox,
} from "@/lib/equipment/label-layout";
import { resolveEquipmentLabelGrid } from "@/lib/equipment/label-grid-settings";
import { fitFontSize, fitTextToWidth, wrapTextLines } from "@/lib/equipment/label-text";
import { buildEqPayload, buildRmPayload, generateQrPng } from "@/lib/equipment/qr";
import { isTestLabelEnvironment } from "@/lib/equipment/qr-url";

type LabelContent = {
  /** Inventární číslo nebo kód místnosti — nikdy se nezkracuje, jen zmenší písmo. */
  code: string;
  /** Místo inventárního čísla dlouhý QR kód (starší položky) → menší písmo. */
  codeIsFallback: boolean;
  /** Název položky nebo místnosti — nejvýš 2 řádky, zbytek „…“. */
  title: string;
  /** Skupina u položky, budova a patro u místnosti. */
  detail?: string;
  /** Počítaná položka (víc kusů na jednom záznamu) → „× N ks“. */
  quantity?: number;
  qrPayload: string;
};

export type LabelPrintOptions = {
  /** Mřížka; bez ní uložené nastavení. */
  spec?: EquipmentLabelGridSpec;
  /** Text vlastníka; bez něj uložené nastavení. */
  ownerText?: string;
  /** Pozice prvního štítku na archu (1 = levý horní). */
  startPosition?: number;
};

const TEST_OWNER_TEXT = "TEST — neplatný štítek";
const QR_GAP_MM = 2;
const CODE_SIZES = [16, 15, 14, 13, 12, 11, 10, 9, 8, 7];
const FALLBACK_CODE_SIZES = [9, 8, 7, 6];

const ptToMm = (pt: number) => (pt / 72) * 25.4;

function drawLabel(
  page: PDFPage,
  fonts: { font: PDFFont; fontBold: PDFFont },
  box: MmBox,
  content: LabelContent,
  qr: PDFImage,
  owner: { text: string; warning: boolean }
) {
  const pageHeightPt = mmToPt(A4_HEIGHT_MM);
  const ink = rgb(0, 0, 0);

  const qrMm = Math.min(box.hMm, box.wMm * 0.45);
  page.drawImage(qr, {
    x: mmToPt(box.xMm),
    y: pageHeightPt - mmToPt(box.yMm + (box.hMm - qrMm) / 2 + qrMm),
    width: mmToPt(qrMm),
    height: mmToPt(qrMm),
  });

  const textXMm = box.xMm + qrMm + QR_GAP_MM;
  const textWidthPt = mmToPt(box.wMm - qrMm - QR_GAP_MM);
  const bottomMm = box.yMm + box.hMm;
  let cursorMm = box.yMm;

  /** Řádek textu shora; vrátí false, když se pod sebe už nevejde. */
  const line = (text: string, size: number, font: PDFFont, color = ink): boolean => {
    const heightMm = ptToMm(size * 1.2);
    if (cursorMm + heightMm > bottomMm + 0.01) return false;
    if (text) {
      page.drawText(text, {
        x: mmToPt(textXMm),
        y: pageHeightPt - mmToPt(cursorMm) - size * 0.9,
        size,
        font,
        color,
      });
    }
    cursorMm += heightMm;
    return true;
  };

  if (owner.text) {
    if (owner.warning) {
      const size = 7;
      const text = fitTextToWidth(owner.text, textWidthPt - 4, (s) => fonts.fontBold.widthOfTextAtSize(s, size));
      page.drawRectangle({
        x: mmToPt(textXMm),
        y: pageHeightPt - mmToPt(cursorMm) - size * 1.2,
        width: fonts.fontBold.widthOfTextAtSize(text, size) + 4,
        height: size * 1.2,
        color: ink,
      });
      page.drawText(text, {
        x: mmToPt(textXMm) + 2,
        y: pageHeightPt - mmToPt(cursorMm) - size * 0.95,
        size,
        font: fonts.fontBold,
        color: rgb(1, 1, 1),
      });
      cursorMm += ptToMm(size * 1.2) + 0.6;
    } else {
      const size = 6;
      line(fitTextToWidth(owner.text, textWidthPt, (s) => fonts.font.widthOfTextAtSize(s, size)), size, fonts.font);
    }
  }

  const codeSize = fitFontSize(
    content.code,
    textWidthPt,
    content.codeIsFallback ? FALLBACK_CODE_SIZES : CODE_SIZES,
    (s, size) => fonts.fontBold.widthOfTextAtSize(s, size)
  );
  line(content.code, codeSize, fonts.fontBold);

  const titleSize = box.hMm >= 40 ? 9 : 7.5;
  const titleLines = wrapTextLines(content.title, textWidthPt, 2, (s) => fonts.font.widthOfTextAtSize(s, titleSize));
  for (const titleLine of titleLines) {
    if (!line(titleLine, titleSize, fonts.font)) break;
  }

  const detailSize = 6;
  const detail = [content.detail, content.quantity && content.quantity > 1 ? `× ${content.quantity} ks` : null]
    .filter(Boolean)
    .join(" · ");
  if (detail) {
    line(
      fitTextToWidth(detail, textWidthPt, (s) => fonts.font.widthOfTextAtSize(s, detailSize)),
      detailSize,
      fonts.font,
      rgb(0.25, 0.25, 0.25)
    );
  }
}

async function buildLabelsPdf(contents: LabelContent[], options: LabelPrintOptions = {}): Promise<Uint8Array> {
  const needSettings = !options.spec || options.ownerText === undefined;
  const resolved = needSettings ? await resolveEquipmentLabelGrid() : null;
  const spec = options.spec ?? resolved!.spec;
  const ownerText = options.ownerText ?? resolved!.settings.ownerText;
  const owner = isTestLabelEnvironment({ APP_ENV: process.env.APP_ENV })
    ? { text: TEST_OWNER_TEXT, warning: true }
    : { text: ownerText, warning: false };

  const { doc, font, fontBold } = await setupPdfWithFonts();
  const placements = planLabelSheets(contents, spec, options.startPosition ?? 1);
  const pages: PDFPage[] = [];
  const pageCount = placements.length ? placements[placements.length - 1].page + 1 : 1;
  for (let i = 0; i < pageCount; i++) pages.push(doc.addPage([mmToPt(A4_WIDTH_MM), mmToPt(A4_HEIGHT_MM)]));

  for (const placement of placements) {
    const qr = await doc.embedPng(await generateQrPng(placement.entry.qrPayload));
    drawLabel(pages[placement.page], { font, fontBold }, labelContentBox(spec, placement.slot), placement.entry, qr, owner);
  }

  return doc.save();
}

type ItemLabelInput = {
  name: string;
  asset_tag: string | null;
  qr_code: string;
  categoryName?: string | null;
  quantity?: number | null;
};

type RoomLabelInput = {
  name: string;
  code: string;
  qr_code: string;
  building?: string | null;
  floor?: string | null;
};

function itemContent(item: ItemLabelInput): LabelContent {
  return {
    code: item.asset_tag ?? item.qr_code,
    codeIsFallback: !item.asset_tag,
    title: item.name,
    detail: item.categoryName ?? undefined,
    quantity: item.quantity ?? undefined,
    qrPayload: buildEqPayload(item.qr_code),
  };
}

function roomContent(room: RoomLabelInput): LabelContent {
  return {
    code: room.code,
    codeIsFallback: false,
    title: room.name,
    detail: [room.building, room.floor].filter(Boolean).join(", ") || undefined,
    qrPayload: buildRmPayload(room.qr_code),
  };
}

export async function buildEquipmentLabelPdf(item: ItemLabelInput, options?: LabelPrintOptions): Promise<Uint8Array> {
  return buildLabelsPdf([itemContent(item)], options);
}

export async function buildRoomLabelPdf(room: RoomLabelInput, options?: LabelPrintOptions): Promise<Uint8Array> {
  return buildLabelsPdf([roomContent(room)], options);
}

export async function buildEquipmentLabelsBulkPdf(
  items: ItemLabelInput[],
  options?: LabelPrintOptions
): Promise<Uint8Array> {
  return buildLabelsPdf(items.map(itemContent), options);
}

export async function buildRoomLabelsBulkPdf(rooms: RoomLabelInput[], options?: LabelPrintOptions): Promise<Uint8Array> {
  return buildLabelsPdf(rooms.map(roomContent), options);
}

export async function buildPoolLabelsBulkPdf(
  codes: { qr_code: string; asset_tag: string }[],
  options?: LabelPrintOptions
): Promise<Uint8Array> {
  return buildLabelsPdf(
    codes.map((code) => ({
      code: code.asset_tag,
      codeIsFallback: false,
      title: "Majetek",
      qrPayload: buildEqPayload(code.qr_code),
    })),
    options
  );
}
