import QRCode from "qrcode";
import { prisma } from "@/lib/db";

export const QR_PREFIX_EQ = "INTEGRAF:EQ:";
export const QR_PREFIX_RM = "INTEGRAF:RM:";

export function buildEqPayload(qrCode: string): string {
  return `${QR_PREFIX_EQ}${qrCode}`;
}

export function buildRmPayload(qrCode: string): string {
  return `${QR_PREFIX_RM}${qrCode}`;
}

export type ParsedEquipmentCode =
  | { kind: "eq"; code: string }
  | { kind: "rm"; code: string }
  | { kind: "raw"; code: string };

/** Parsuje naskenovaný text (plný payload nebo holý kód). */
export function parseEquipmentScanCode(raw: string): ParsedEquipmentCode {
  const text = raw.trim();
  if (!text) return { kind: "raw", code: "" };

  const upper = text.toUpperCase();
  if (upper.startsWith(QR_PREFIX_EQ)) {
    return { kind: "eq", code: text.slice(QR_PREFIX_EQ.length).trim() };
  }
  if (upper.startsWith(QR_PREFIX_RM)) {
    return { kind: "rm", code: text.slice(QR_PREFIX_RM.length).trim() };
  }
  if (upper.startsWith("EQ-") || /^\d{12}$/.test(text)) {
    return { kind: "eq", code: text };
  }
  if (upper.startsWith("RM-")) {
    return { kind: "rm", code: text };
  }
  return { kind: "raw", code: text };
}

function randomDigits(n: number): string {
  let s = "";
  for (let i = 0; i < n; i++) {
    s += Math.floor(Math.random() * 10).toString();
  }
  return s;
}

/** Hromadná alokace unikátních kódů bez DB roundtripu na každý pokus. */
export function allocateUniqueNumericCodes(
  count: number,
  length: number,
  existing: Iterable<string>,
  format: (digits: string) => string = (d) => d
): string[] {
  if (count <= 0) return [];
  const used = new Set(existing);
  const out: string[] = [];
  const maxAttempts = Math.max(count * 80, count + 200);
  let attempts = 0;
  while (out.length < count && attempts < maxAttempts) {
    attempts += 1;
    const code = format(randomDigits(length));
    if (used.has(code)) continue;
    used.add(code);
    out.push(code);
  }
  if (out.length < count) {
    throw new Error("Nepodařilo se vygenerovat unikátní kódy");
  }
  return out;
}

export function allocateUniqueEqQrCodes(count: number, existing: Iterable<string>): string[] {
  return allocateUniqueNumericCodes(count, 12, existing);
}

export function allocateUniqueRmQrCodes(count: number, existing: Iterable<string>): string[] {
  return allocateUniqueNumericCodes(count, 12, existing, (d) => `RM-${d}`);
}

export async function generateUniqueEqQrCode(): Promise<string> {
  for (let i = 0; i < 20; i++) {
    const code = randomDigits(12);
    const [item, pool] = await Promise.all([
      prisma.equipment_items.findFirst({ where: { qr_code: code }, select: { id: true } }),
      prisma.equipment_qr_pool.findFirst({ where: { qr_code: code }, select: { id: true } }),
    ]);
    if (!item && !pool) return code;
  }
  throw new Error("Nepodařilo se vygenerovat unikátní QR kód");
}

export async function generateUniqueRmQrCode(): Promise<string> {
  for (let i = 0; i < 20; i++) {
    const code = `RM-${randomDigits(12)}`;
    const room = await prisma.equipment_rooms.findFirst({
      where: { qr_code: code },
      select: { id: true },
    });
    if (!room) return code;
  }
  throw new Error("Nepodařilo se vygenerovat unikátní QR místnosti");
}

export async function generateUniqueAssetTag(): Promise<string> {
  for (let i = 0; i < 30; i++) {
    const n = Math.floor(Math.random() * 1e8);
    const tag = `EQ-${String(n).padStart(8, "0")}`;
    const [item, pool] = await Promise.all([
      prisma.equipment_items.findFirst({ where: { asset_tag: tag }, select: { id: true } }),
      prisma.equipment_qr_pool.findFirst({ where: { asset_tag: tag }, select: { id: true } }),
    ]);
    if (!item && !pool) return tag;
  }
  throw new Error("Nepodařilo se vygenerovat inventární číslo");
}

export async function generateQrPng(payload: string): Promise<Buffer> {
  return QRCode.toBuffer(payload, {
    type: "png",
    width: 256,
    margin: 1,
    errorCorrectionLevel: "M",
  });
}
