import crypto from "crypto";
import { prisma } from "@/lib/db";

export type TokenPurpose = "password_reset" | "account_activation";

export const TOKEN_TTL_MS: Record<TokenPurpose, number> = {
  password_reset: 30 * 60 * 1000, // 30 minut
  account_activation: 7 * 24 * 60 * 60 * 1000, // 7 dní
};

/** SHA-256 hash (hex, 64 znaků) – to co ukládáme do DB. */
export function hashToken(rawToken: string): string {
  return crypto.createHash("sha256").update(rawToken).digest("hex");
}

/**
 * Vytvoří jednorázový token:
 *  1. Smaže existující nepoužité tokeny stejného purpose pro daného uživatele (aby nebyl platný starý).
 *  2. Vygeneruje bezpečný náhodný token (256 bitů, base64url, cca 43 znaků).
 *  3. Uloží SHA-256 hash + expiraci.
 *  4. Vrátí plaintext token, který se pošle do URL v e-mailu.
 */
export async function createUserToken(params: {
  userId: number;
  purpose: TokenPurpose;
  ip?: string | null;
}): Promise<{ token: string; expiresAt: Date }> {
  const { userId, purpose, ip } = params;

  await prisma.user_tokens.deleteMany({
    where: { user_id: userId, purpose, used_at: null },
  });

  const raw = crypto.randomBytes(32).toString("base64url");
  const token_hash = hashToken(raw);
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MS[purpose]);

  await prisma.user_tokens.create({
    data: {
      user_id: userId,
      purpose,
      token_hash,
      expires_at: expiresAt,
      ip_created: ip ?? null,
    },
  });

  return { token: raw, expiresAt };
}

export type TokenVerifyResult =
  | { ok: true; userId: number; tokenId: number }
  | { ok: false; reason: "not_found" | "expired" | "used" | "wrong_purpose" };

/**
 * Ověří token, ale NEPOUŽIJE ho (slouží pro validaci na stránce /reset-password před
 * zobrazením formuláře). Samotné "spotřebování" dělá `consumeUserToken`.
 */
export async function verifyUserToken(
  rawToken: string,
  expectedPurpose: TokenPurpose
): Promise<TokenVerifyResult> {
  if (!rawToken || typeof rawToken !== "string") {
    return { ok: false, reason: "not_found" };
  }
  const token_hash = hashToken(rawToken);
  const row = await prisma.user_tokens.findUnique({ where: { token_hash } });
  if (!row) return { ok: false, reason: "not_found" };
  if (row.purpose !== expectedPurpose) return { ok: false, reason: "wrong_purpose" };
  if (row.used_at) return { ok: false, reason: "used" };
  if (row.expires_at.getTime() < Date.now()) return { ok: false, reason: "expired" };
  return { ok: true, userId: row.user_id, tokenId: row.id };
}

/**
 * Označí token jako použitý. Volat až po úspěšné akci (např. zápisu nového hesla).
 */
export async function consumeUserToken(tokenId: number, ip?: string | null) {
  await prisma.user_tokens.update({
    where: { id: tokenId },
    data: { used_at: new Date(), ip_used: ip ?? null },
  });
}

/** Stručný text pro lokalizované chyby ve verify výsledku. */
export function tokenReasonText(reason: Exclude<TokenVerifyResult, { ok: true }>["reason"]): string {
  switch (reason) {
    case "expired":
      return "Odkaz vypršel. Požádejte prosím o nový.";
    case "used":
      return "Odkaz již byl použit. Pokud potřebujete heslo změnit znovu, požádejte o nový odkaz.";
    case "wrong_purpose":
      return "Tento odkaz není určen k této akci.";
    default:
      return "Odkaz je neplatný nebo již neexistuje.";
  }
}
