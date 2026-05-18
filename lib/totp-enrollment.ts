import { prisma } from "@/lib/db";
import { verifyLoginChallenge } from "@/lib/login-challenge";
import {
  generateTotpSetup,
  encryptSecretForDb,
  decryptSecretFromDb,
  verifyTotpCodeEncrypted,
} from "@/lib/totp";
import { generateURI } from "otplib";
import QRCode from "qrcode";
import { createBackupCodesForUser } from "@/lib/totp-backup-codes";

export async function getUserForEnrollmentChallenge(loginChallenge: string) {
  const challenge = await verifyLoginChallenge(loginChallenge);
  if (!challenge) return null;

  const user = await prisma.users.findFirst({
    where: {
      id: challenge.userId,
      OR: [{ is_active: true }, { is_active: null }],
    },
    select: {
      id: true,
      username: true,
      email: true,
      password_version: true,
      totp_enrollment_required: true,
      totp_enabled: true,
      totp_secret_enc: true,
    },
  });

  if (
    !user ||
    user.password_version !== challenge.passwordVersion ||
    !user.totp_enrollment_required ||
    user.totp_enabled
  ) {
    return null;
  }

  return user;
}

/** Vygeneruje secret (pokud chybí) a vrátí QR pro enrollment. */
export async function prepareTotpEnrollment(userId: number) {
  const user = await prisma.users.findUnique({
    where: { id: userId },
    select: { username: true, email: true, totp_secret_enc: true },
  });
  if (!user) return null;

  if (user.totp_secret_enc) {
    const secret = decryptSecretFromDb(user.totp_secret_enc);
    const label = user.email?.trim() || user.username;
    const otpauthUri = generateURI({ issuer: "INTEGRAF", label, secret });
    const qrDataUrl = await QRCode.toDataURL(otpauthUri, { width: 220, margin: 1 });
    return { qrDataUrl, alreadyHadSecret: true };
  }

  const setup = await generateTotpSetup({
    username: user.username,
    email: user.email,
  });

  await prisma.users.update({
    where: { id: userId },
    data: { totp_secret_enc: encryptSecretForDb(setup.secret) },
  });

  return { qrDataUrl: setup.qrDataUrl, alreadyHadSecret: false };
}

/** Ověří první TOTP kód, aktivuje 2FA a vrátí záložní kódy. */
export async function confirmTotpEnrollment(
  userId: number,
  code: string
): Promise<{ backupCodes: string[] } | null> {
  const user = await prisma.users.findUnique({
    where: { id: userId },
    select: { totp_secret_enc: true, totp_enrollment_required: true, totp_enabled: true },
  });

  if (!user?.totp_secret_enc || !user.totp_enrollment_required || user.totp_enabled) {
    return null;
  }

  const valid = await verifyTotpCodeEncrypted(user.totp_secret_enc, code);
  if (!valid) return null;

  const backupCodes = await createBackupCodesForUser(userId);

  await prisma.users.update({
    where: { id: userId },
    data: {
      totp_enabled: true,
      totp_enabled_at: new Date(),
    },
  });

  return { backupCodes };
}
