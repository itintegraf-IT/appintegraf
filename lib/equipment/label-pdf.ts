import { rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { setupPdfWithFonts } from "@/lib/vyroba/protocol/fonts";
import {
  A4_HEIGHT_MM,
  A4_WIDTH_MM,
  LABEL_HEIGHT_MM,
  LABEL_WIDTH_MM,
  getLabelSlotsOnA4,
  mmToPt,
} from "@/lib/equipment/label-layout";
import { buildEqPayload, buildRmPayload, generateQrPng } from "@/lib/equipment/qr";

type LabelContent = {
  title: string;
  subtitle?: string;
  line3?: string;
  qrPayload: string;
  assetTag: string;
};

async function drawVisitkaLabel(
  page: PDFPage,
  font: PDFFont,
  fontBold: PDFFont,
  x: number,
  y: number,
  content: LabelContent,
  qrImage: Awaited<ReturnType<Awaited<ReturnType<typeof setupPdfWithFonts>>["doc"]["embedPng"]>>
) {
  const w = mmToPt(LABEL_WIDTH_MM);
  const h = mmToPt(LABEL_HEIGHT_MM);
  const pad = mmToPt(3);

  page.drawRectangle({
    x,
    y,
    width: w,
    height: h,
    borderColor: rgb(0.2, 0.2, 0.2),
    borderWidth: 0.8,
  });

  const qrSize = mmToPt(28);
  page.drawImage(qrImage, {
    x: x + pad,
    y: y + (h - qrSize) / 2,
    width: qrSize,
    height: qrSize,
  });

  const textX = x + pad + qrSize + mmToPt(2);
  const maxTextW = w - (textX - x) - pad;
  let ty = y + h - pad - 10;

  const title = content.title.slice(0, 40);
  page.drawText(title, {
    x: textX,
    y: ty,
    size: 8,
    font: fontBold,
    color: rgb(0, 0, 0),
    maxWidth: maxTextW,
  });
  ty -= 11;

  page.drawText(content.assetTag, {
    x: textX,
    y: ty,
    size: 7,
    font,
    color: rgb(0.15, 0.15, 0.15),
    maxWidth: maxTextW,
  });
  ty -= 10;

  if (content.subtitle) {
    page.drawText(content.subtitle.slice(0, 36), {
      x: textX,
      y: ty,
      size: 6.5,
      font,
      color: rgb(0.3, 0.3, 0.3),
      maxWidth: maxTextW,
    });
    ty -= 9;
  }
  if (content.line3) {
    page.drawText(content.line3.slice(0, 36), {
      x: textX,
      y: ty,
      size: 6,
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
  codes: { qr_code: string; asset_tag: string }[]
): Promise<Uint8Array> {
  const { doc, font, fontBold } = await setupPdfWithFonts();
  const slots = getLabelSlotsOnA4();
  let slotIdx = 0;
  let page = doc.addPage([mmToPt(A4_WIDTH_MM), mmToPt(A4_HEIGHT_MM)]);

  for (const code of codes) {
    if (slotIdx >= slots.length) {
      page = doc.addPage([mmToPt(A4_WIDTH_MM), mmToPt(A4_HEIGHT_MM)]);
      slotIdx = 0;
    }
    const slot = slots[slotIdx++];
    const png = await generateQrPng(buildEqPayload(code.qr_code));
    const img = await doc.embedPng(png);
    await drawVisitkaLabel(
      page,
      font,
      fontBold,
      slot.x,
      slot.y,
      {
        title: "INTEGRAF",
        subtitle: "Majetek",
        assetTag: code.asset_tag,
        qrPayload: buildEqPayload(code.qr_code),
      },
      img
    );
  }

  return doc.save();
}

export async function buildEquipmentLabelsBulkPdf(
  items: {
    name: string;
    asset_tag: string | null;
    qr_code: string;
    categoryName?: string | null;
  }[]
): Promise<Uint8Array> {
  const { doc, font, fontBold } = await setupPdfWithFonts();
  const slots = getLabelSlotsOnA4();
  let slotIdx = 0;
  let page = doc.addPage([mmToPt(A4_WIDTH_MM), mmToPt(A4_HEIGHT_MM)]);

  for (const item of items) {
    if (slotIdx >= slots.length) {
      page = doc.addPage([mmToPt(A4_WIDTH_MM), mmToPt(A4_HEIGHT_MM)]);
      slotIdx = 0;
    }
    const slot = slots[slotIdx++];
    const png = await generateQrPng(buildEqPayload(item.qr_code));
    const img = await doc.embedPng(png);
    await drawVisitkaLabel(
      page,
      font,
      fontBold,
      slot.x,
      slot.y,
      {
        title: item.name,
        subtitle: item.categoryName ?? undefined,
        assetTag: item.asset_tag ?? item.qr_code,
        qrPayload: buildEqPayload(item.qr_code),
      },
      img
    );
  }

  return doc.save();
}
