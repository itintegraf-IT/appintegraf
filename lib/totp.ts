import { generateSecret, generateURI, verify } from "otplib";
import QRCode from "qrcode";
import { encryptTotpSecret, decryptTotpSecret } from "@/lib/totp-crypto";

const ISSUER = "INTEGRAF";
const EPOCH_TOLERANCE = 30;

export type TotpSetupResult = {
  secret: string;
  qrDataUrl: string;
  otpauthUri: string;
};

/** Vygeneruje nový TOTP secret a QR kód pro Google Authenticator. */
export async function generateTotpSetup(params: {
  username: string;
  email?: string | null;
}): Promise<TotpSetupResult> {
  const secret = generateSecret();
  const label = params.email?.trim() || params.username;
  const otpauthUri = generateURI({
    issuer: ISSUER,
    label,
    secret,
  });
  const qrDataUrl = await QRCode.toDataURL(otpauthUri, {
    width: 220,
    margin: 1,
  });
  return { secret, qrDataUrl, otpauthUri };
}

export function encryptSecretForDb(secret: string): string {
  return encryptTotpSecret(secret);
}

export function decryptSecretFromDb(encrypted: string): string {
  return decryptTotpSecret(encrypted);
}

/** Ověří 6místný TOTP kód proti secretu (plain nebo dešifrovaný). */
export async function verifyTotpCode(secret: string, code: string): Promise<boolean> {
  const normalized = code.replace(/\s/g, "");
  if (!/^\d{6}$/.test(normalized)) {
    return false;
  }
  const result = await verify({
    secret,
    token: normalized,
    epochTolerance: EPOCH_TOLERANCE,
  });
  return result.valid === true;
}

/** Ověří kód proti šifrovanému secretu v DB. */
export async function verifyTotpCodeEncrypted(
  secretEnc: string,
  code: string
): Promise<boolean> {
  const secret = decryptSecretFromDb(secretEnc);
  return verifyTotpCode(secret, code);
}
