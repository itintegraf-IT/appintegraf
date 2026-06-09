import { createHmac, randomBytes, timingSafeEqual } from "crypto";
import { AppError } from "@/lib/crm/errors";

const MAX_AGE_MS = 15 * 60 * 1000;

function secret(): string {
  const s = process.env.AUTH_SECRET?.trim() || process.env.CRM_CRON_SECRET?.trim();
  if (!s) throw new AppError("INTERNAL", "Chybí AUTH_SECRET pro OAuth state.");
  return s;
}

export function signOAuthState(userId: number): string {
  const nonce = randomBytes(16).toString("hex");
  const ts = Date.now();
  const payload = `${userId}:${nonce}:${ts}`;
  const sig = createHmac("sha256", secret()).update(payload).digest("hex");
  return Buffer.from(`${payload}:${sig}`).toString("base64url");
}

export function verifyOAuthState(state: string): number {
  let decoded: string;
  try {
    decoded = Buffer.from(state, "base64url").toString("utf8");
  } catch {
    throw new AppError("VALIDATION", "Neplatný OAuth state.");
  }
  const parts = decoded.split(":");
  if (parts.length !== 4) throw new AppError("VALIDATION", "Neplatný OAuth state.");
  const [userIdStr, , tsStr, sig] = parts;
  const payload = `${userIdStr}:${parts[1]}:${tsStr}`;
  const expected = createHmac("sha256", secret()).update(payload).digest("hex");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    throw new AppError("VALIDATION", "Neplatný OAuth state podpis.");
  }
  const ts = parseInt(tsStr, 10);
  if (Number.isNaN(ts) || Date.now() - ts > MAX_AGE_MS) {
    throw new AppError("VALIDATION", "OAuth state vypršel.");
  }
  const userId = parseInt(userIdStr, 10);
  if (Number.isNaN(userId) || userId <= 0) {
    throw new AppError("VALIDATION", "Neplatný uživatel v OAuth state.");
  }
  return userId;
}
