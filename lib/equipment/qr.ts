import QRCode from "qrcode";
import { prisma } from "@/lib/db";
import { buildQrPayload, qrLabelBlockedReason, resolveQrBaseUrl } from "@/lib/equipment/qr-url";

// Parser kódu žije v čistém modulu scan-code.ts (bez Prismy, použitelný i v klientu).
export { QR_PREFIX_EQ, QR_PREFIX_RM, parseEquipmentScanCode, type ParsedEquipmentCode } from "@/lib/equipment/scan-code";

function qrBaseEnv() {
  return { EQUIPMENT_QR_BASE_URL: process.env.EQUIPMENT_QR_BASE_URL, AUTH_URL: process.env.AUTH_URL };
}

function qrBaseUrl(): string | null {
  return resolveQrBaseUrl(qrBaseEnv());
}

/** Důvod, proč teď štítky netisknout (chybí adresa aplikace pro odkaz v QR); jinak null. */
export function labelPrintBlockedReason(): string | null {
  return qrLabelBlockedReason(qrBaseEnv());
}

/** Obsah QR položky: odkaz do aplikace (`EQUIPMENT_QR_BASE_URL` / `AUTH_URL`), jinak starý textový formát. */
export function buildEqPayload(qrCode: string): string {
  return buildQrPayload("item", qrCode, qrBaseUrl());
}

/** Obsah QR místnosti: odkaz do aplikace (`EQUIPMENT_QR_BASE_URL` / `AUTH_URL`), jinak starý textový formát. */
export function buildRmPayload(qrCode: string): string {
  return buildQrPayload("room", qrCode, qrBaseUrl());
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
