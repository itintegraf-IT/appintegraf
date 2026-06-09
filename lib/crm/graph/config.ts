export const GRAPH_PROVIDER = "microsoft-entra-id";

export function getGraphPageSize(): number {
  const raw = process.env.CRM_GRAPH_SYNC_PAGE_SIZE;
  const n = raw ? parseInt(raw, 10) : 50;
  return Number.isFinite(n) && n > 0 ? Math.min(n, 200) : 50;
}

export function isGraphSyncEnabled(): boolean {
  return process.env.CRM_GRAPH_SYNC_ENABLED === "true";
}

export function getMicrosoftEntraConfig(): {
  clientId: string;
  clientSecret: string;
  tenantId: string;
  tokenUrl: string;
  authorizeUrl: string;
} | null {
  const clientId = process.env.AUTH_MICROSOFT_ENTRA_ID_CLIENT_ID?.trim();
  const clientSecret = process.env.AUTH_MICROSOFT_ENTRA_ID_CLIENT_SECRET?.trim();
  const tenantId = process.env.AUTH_MICROSOFT_ENTRA_ID_TENANT_ID?.trim();
  if (!clientId || !clientSecret || !tenantId) return null;
  const base = `https://login.microsoftonline.com/${tenantId}`;
  return {
    clientId,
    clientSecret,
    tenantId,
    tokenUrl: `${base}/oauth2/v2.0/token`,
    authorizeUrl: `${base}/oauth2/v2.0/authorize`,
  };
}

export function getCrmCronSecret(): string | null {
  const s = process.env.CRM_CRON_SECRET?.trim();
  return s && s.length >= 16 ? s : null;
}

export const GRAPH_OAUTH_SCOPES =
  "openid profile email offline_access User.Read Mail.Read";

export function getAppBaseUrl(): string {
  const explicit =
    process.env.AUTH_URL?.trim() ||
    process.env.NEXTAUTH_URL?.trim() ||
    process.env.APP_URL?.trim();
  if (explicit) return explicit.replace(/\/+$/, "");
  const vercel = process.env.VERCEL_URL?.trim();
  if (vercel) {
    return (vercel.startsWith("http") ? vercel : `https://${vercel}`).replace(/\/+$/, "");
  }
  return "http://localhost:3000";
}

export function getGraphCallbackUrl(): string {
  return `${getAppBaseUrl()}/api/crm/integrations/graph/callback`;
}
