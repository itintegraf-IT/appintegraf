import { rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { setupPdfWithFonts } from "@/lib/vyroba/protocol/fonts";
import {
  A4_HEIGHT_MM,
  A4_WIDTH_MM,
  LABEL_HEIGHT_MM,
  LABEL_WIDTH_MM,
  getLabelSlotsOnA4,
  mmToPt,
  type EquipmentLabelGridSpec,
} from "@/lib/equipment/label-layout";
import { resolveEquipmentLabelGrid } from "@/lib/equipment/label-grid-settings";
import { buildEqPayload, buildRmPayload, generateQrPng } from "@/lib/equipment/qr";

type LabelContent = {
  title: string;
  subtitle?: string;
  line3?: string;
  qrPayload: string;
  assetTag: string;
};

type QrImage = Awaited<
  ReturnType<Awaited<ReturnType<typeof setupPdfWithFonts>>["doc"]["embedPng"]>
>;

async function drawVisitkaLabel(
  page: PDFPage,
  font: PDFFont,
  fontBold: PDFFont,
  x: number,
  y: number,
  content: LabelContent,
  qrImage: QrImage,
  sizeMm: { widthMm: number; heightMm: number } = {
    widthMm: LABEL_WIDTH_MM,
    heightMm: LABEL_HEIGHT_MM,
  }
) {
  const w = mmToPt(sizeMm.widthMm);
  const h = mmToPt(sizeMm.heightMm);
  const pad = mmToPt(Math.min(3, sizeMm.widthMm * 0.05));
  const scale = Math.min(sizeMm.widthMm / LABEL_WIDTH_MM, sizeMm.heightMm / LABEL_HEIGHT_MM, 1.2);

  page.drawRectangle({
    x,
    y,
    width: w,
    height: h,
    borderColor: rgb(0.2, 0.2, 0.2),
    borderWidth: 0.8,
  });

  const qrSize = Math.min(mmToPt(28 * scale), h - pad * 2, w * 0.42);
  page.drawImage(qrImage, {
    x: x + pad,
    y: y + (h - qrSize) / 2,
    width: qrSize,
    height: qrSize,
  });

  const textX = x + pad + qrSize + mmToPt(2);
  const maxTextW = Math.max(8, w - (textX - x) - pad);
  let ty = y + h - pad - 8 * scale;
  const titleSize = Math.max(5.5, 8 * scale);
  const tagSize = Math.max(5, 7 * scale);
  const subSize = Math.max(4.5, 6.5 * scale);

  page.drawText(content.title.slice(0, 40), {
    x: textX,
    y: ty,
    size: titleSize,
    font: fontBold,
    color: rgb(0, 0, 0),
    maxWidth: maxTextW,
  });
  ty -= titleSize + 3;

  page.drawText(content.assetTag, {
    x: textX,
    y: ty,
    size: tagSize,
    font,
    color: rgb(0.15, 0.15, 0.15),
    maxWidth: maxTextW,
  });
  ty -= tagSize + 2;

  if (content.subtitle && ty > y + pad + 6) {
    page.drawText(content.subtitle.slice(0, 36), {
      x: textX,
      y: ty,
      size: subSize,
      font,
      color: rgb(0.3, 0.3, 0.3),
      maxWidth: maxTextW,
    });
    ty -= subSize + 2;
  }
  if (content.line3 && ty > y + pad + 4) {
    page.drawText(content.line3.slice(0, 36), {
      x: textX,
      y: ty,
      size: Math.max(4, 6 * scale),
      font,
      color: rgb(0.35, 0.35, 0.35),
      maxWidth: maxTextW,
    });
  }
}

async function buildSingleLabelPdf(content: LabelContent): Promise<Uint8Array> {
  const { doc, font, fontBold } = await setupPdfWithFonts();
  const page = doc.addPage([mmToPt(LABEL_WIDTH_MM), mmToPt(LABEL_HEIGHT_MM)]);
  const png = await generateQrPng(content.qrPayload);
  const img = await doc.embedPng(png);
  await drawVisitkaLabel(page, font, fontBold, 0, 0, content, img);
  return doc.save();
}

async function resolveBulkSpec(spec?: EquipmentLabelGridSpec | null, layoutKey?: string | null) {
  if (spec) return spec;
  const resolved = await resolveEquipmentLabelGrid(layoutKey);
  return resolved.spec;
}

async function buildBulkLabelsPdf(
  items: LabelContent[],
  options?: { spec?: EquipmentLabelGridSpec | null; layoutKey?: string | null }
): Promise<Uint8Array> {
  const grid = await resolveBulkSpec(options?.spec, options?.layoutKey);
  const { doc, font, fontBold } = await setupPdfWithFonts();
  const slots = getLabelSlotsOnA4(grid);
  let slotIdx = 0;
  let page = doc.addPage([mmToPt(A4_WIDTH_MM), mmToPt(A4_HEIGHT_MM)]);

  for (const content of items) {
    if (slotIdx >= slots.length) {
      page = doc.addPage([mmToPt(A4_WIDTH_MM), mmToPt(A4_HEIGHT_MM)]);
      slotIdx = 0;
    }
    const slot = slots[slotIdx++];
    const png = await generateQrPng(content.qrPayload);
    const img = await doc.embedPng(png);
    await drawVisitkaLabel(page, font, fontBold, slot.x, slot.y, content, img, {
      widthMm: slot.widthMm,
      heightMm: slot.heightMm,
    });
  }

  return doc.save();
}

export async function buildEquipmentLabelPdf(item: {
  name: string;
  asset_tag: string | null;
  qr_code: string;
  categoryName?: string | null;
}): Promise<Uint8Array> {
  return buildSingleLabelPdf({
    title: item.name,
    subtitle: item.categoryName ?? undefined,
    assetTag: item.asset_tag ?? item.qr_code,
    qrPayload: buildEqPayload(item.qr_code),
  });
}

export async function buildRoomLabelPdf(room: {
  name: string;
  code: string;
  qr_code: string;
  building?: string | null;
  floor?: string | null;
}): Promise<Uint8Array> {
  const line3 = [room.building, room.floor].filter(Boolean).join(", ") || undefined;
  return buildSingleLabelPdf({
    title: room.name,
    subtitle: room.code,
    line3,
    assetTag: room.code,
    qrPayload: buildRmPayload(room.qr_code),
  });
}

export async function buildPoolLabelsBulkPdf(
  codes: { qr_code: string; asset_tag: string }[],
  options?: { spec?: EquipmentLabelGridSpec | null; layoutKey?: string | null }
): Promise<Uint8Array> {
  return buildBulkLabelsPdf(
    codes.map((code) => ({
      title: "INTEGRAF",
      subtitle: "Majetek",
      assetTag: code.asset_tag,
      qrPayload: buildEqPayload(code.qr_code),
    })),
    options
  );
}

export async function buildEquipmentLabelsBulkPdf(
  items: {
    name: string;
    asset_tag: string | null;
    qr_code: string;
    categoryName?: string | null;
  }[],
  options?: { spec?: EquipmentLabelGridSpec | null; layoutKey?: string | null }
): Promise<Uint8Array> {
  return buildBulkLabelsPdf(
    items.map((item) => ({
      title: item.name,
      subtitle: item.categoryName ?? undefined,
      assetTag: item.asset_tag ?? item.qr_code,
      qrPayload: buildEqPayload(item.qr_code),
    })),
    options
  );
}

export async function buildRoomLabelsBulkPdf(
  rooms: {
    name: string;
    code: string;
    qr_code: string;
    building?: string | null;
    floor?: string | null;
  }[],
  options?: { spec?: EquipmentLabelGridSpec | null; layoutKey?: string | null }
): Promise<Uint8Array> {
  return buildBulkLabelsPdf(
    rooms.map((room) => ({
      title: room.name,
      subtitle: room.code,
      line3: [room.building, room.floor].filter(Boolean).join(", ") || undefined,
      assetTag: room.code,
      qrPayload: buildRmPayload(room.qr_code),
    })),
    options
  );
}
