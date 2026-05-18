import crypto from "crypto";
import { prisma } from "@/lib/db";
import { hashToken } from "@/lib/tokens";

const BACKUP_CODE_COUNT = 10;

function randomSegment(len: number): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.randomBytes(len);
  let out = "";
  for (let i = 0; i < len; i++) {
    out += chars[bytes[i]! % chars.length];
  }
  return out;
}

/** Vygeneruje jeden záložní kód ve formátu XXXX-XXXX. */
export function generateBackupCodePlain(): string {
  return `${randomSegment(4)}-${randomSegment(4)}`;
}

export function normalizeBackupCode(input: string): string {
  return input.replace(/\s/g, "").toUpperCase();
}

/** Vygeneruje sadu záložních kódů a uloží hashe do DB. Vrátí plaintext kódy (zobrazit jen jednou). */
export async function createBackupCodesForUser(userId: number): Promise<string[]> {
  await prisma.user_totp_backup_codes.deleteMany({ where: { user_id: userId } });

  const plainCodes: string[] = [];
  const rows: { user_id: number; code_hash: string }[] = [];

  for (let i = 0; i < BACKUP_CODE_COUNT; i++) {
    let plain = generateBackupCodePlain();
    let attempts = 0;
    while (plainCodes.includes(plain) && attempts < 20) {
      plain = generateBackupCodePlain();
      attempts++;
    }
    plainCodes.push(plain);
    rows.push({ user_id: userId, code_hash: hashToken(normalizeBackupCode(plain)) });
  }

  await prisma.user_totp_backup_codes.createMany({ data: rows });
  return plainCodes;
}

/** Ověří a spotřebuje záložní kód. */
export async function consumeBackupCode(
  userId: number,
  codeInput: string
): Promise<boolean> {
  const normalized = normalizeBackupCode(codeInput);
  if (normalized.length < 8) {
    return false;
  }
  const codeHash = hashToken(normalized);

  const row = await prisma.user_totp_backup_codes.findFirst({
    where: {
      user_id: userId,
      code_hash: codeHash,
      used_at: null,
    },
  });

  if (!row) {
    return false;
  }

  await prisma.user_totp_backup_codes.update({
    where: { id: row.id },
    data: { used_at: new Date() },
  });
  return true;
}

export async function deleteBackupCodesForUser(userId: number): Promise<void> {
  await prisma.user_totp_backup_codes.deleteMany({ where: { user_id: userId } });
}
