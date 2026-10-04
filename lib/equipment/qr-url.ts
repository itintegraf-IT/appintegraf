/**
 * Obsah QR kódu na štítku — čistá logika bez DB (použitelná i v klientu).
 * QR nese odkaz `<adresa aplikace>/q/<kód>`, takže ho otevře i fotoaparát telefonu.
 * Bez platné adresy aplikace (lokální vývoj) zůstává starý textový formát.
 */

export const QR_PREFIX_EQ = "INTEGRAF:EQ:";
export const QR_PREFIX_RM = "INTEGRAF:RM:";

const LOCAL_HOSTS = new Set(["localhost", "0.0.0.0", "::1", "[::1]"]);

export type QrBaseUrlEnv = { EQUIPMENT_QR_BASE_URL?: string; AUTH_URL?: string };

/**
 * Adresa aplikace pro odkaz v QR: `EQUIPMENT_QR_BASE_URL`, jinak `AUTH_URL`.
 * Jen http/https a nikdy localhost — štítek je trvalý a musí jít otevřít z telefonu.
 */
export function resolveQrBaseUrl(env: QrBaseUrlEnv): string | null {
  for (const raw of [env.EQUIPMENT_QR_BASE_URL, env.AUTH_URL]) {
    const value = raw?.trim();
    if (!value) continue;
    let url: URL;
    try {
      url = new URL(value);
    } catch {
      continue;
    }
    if (url.protocol !== "http:" && url.protocol !== "https:") continue;
    const host = url.hostname.toLowerCase();
    if (LOCAL_HOSTS.has(host) || host.startsWith("127.")) continue;
    return url.origin;
  }
  return null;
}

/** Obsah QR: odkaz `<base>/q/<kód>`, bez adresy aplikace starý formát `INTEGRAF:EQ:` / `INTEGRAF:RM:`. */
export function buildQrPayload(kind: "item" | "room", code: string, baseUrl: string | null): string {
  if (baseUrl) return `${baseUrl}/q/${encodeURIComponent(code)}`;
  return `${kind === "room" ? QR_PREFIX_RM : QR_PREFIX_EQ}${code}`;
}

const QR_URL_RE = /^https?:\/\/[^/\s?#]+\/q\/([^/?#\s]+)\/?(?:[?#]\S*)?$/i;

/** Z odkazu `<cokoli>/q/<kód>` vrátí kód; jiný text (nebo rozbité kódování) → null. */
export function extractQrUrlCode(raw: string): string | null {
  const match = QR_URL_RE.exec(raw.trim());
  if (!match) return null;
  try {
    const code = decodeURIComponent(match[1]).trim();
    return code || null;
  } catch {
    return null;
  }
}

/** Štítek z testovacího prostředí nese výrazné „TEST“, aby se omylem nenalepil. */
export function isTestLabelEnvironment(env: { APP_ENV?: string }): boolean {
  return (env.APP_ENV ?? "").trim().toLowerCase() === "test";
}
