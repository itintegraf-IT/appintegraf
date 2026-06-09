import { prisma } from "@/lib/db";
import { AppError } from "@/lib/crm/errors";
import { logger } from "@/lib/crm/logger";
import { getMicrosoftEntraConfig, GRAPH_PROVIDER } from "./config";

const REFRESH_SKEW_SECONDS = 60;

export async function getAccessToken(userId: number): Promise<string> {
  const account = await prisma.crm_graph_accounts.findFirst({
    where: { user_id: userId, provider: GRAPH_PROVIDER },
  });
  if (!account?.refresh_token) {
    throw new AppError("NOT_FOUND", "Uživatel nemá připojený Microsoft účet.");
  }

  const nowSec = Math.floor(Date.now() / 1000);
  const expiresAt = account.expires_at ?? 0;
  if (account.access_token && expiresAt - nowSec > REFRESH_SKEW_SECONDS) {
    return account.access_token;
  }

  return refreshAccessToken(account.id, account.refresh_token);
}

async function refreshAccessToken(accountId: string, refreshToken: string): Promise<string> {
  const cfg = getMicrosoftEntraConfig();
  if (!cfg) {
    throw new AppError("INTERNAL", "Microsoft Entra konfigurace chybí.");
  }

  const body = new URLSearchParams({
    client_id: cfg.clientId,
    client_secret: cfg.clientSecret,
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    scope: "openid profile email offline_access User.Read Mail.Read",
  });

  const resp = await fetch(cfg.tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!resp.ok) {
    const text = await resp.text();
    logger.error("[crm-graph/token] refresh selhal", { status: resp.status, body: text });
    throw new AppError("INTERNAL", `MS token refresh selhal: ${resp.status}`);
  }

  const data = (await resp.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
    token_type?: string;
    scope?: string;
  };

  if (typeof data.access_token !== "string" || typeof data.expires_in !== "number") {
    throw new AppError("INTERNAL", "Neplatná odpověď z MS token endpointu.");
  }

  const newExpiresAt = Math.floor(Date.now() / 1000) + data.expires_in;
  await prisma.crm_graph_accounts.update({
    where: { id: accountId },
    data: {
      access_token: data.access_token,
      refresh_token: data.refresh_token ?? refreshToken,
      expires_at: newExpiresAt,
      token_type: data.token_type,
      scope: data.scope,
    },
  });

  return data.access_token;
}

export async function invalidateGraphToken(userId: number): Promise<void> {
  await prisma.crm_graph_accounts.updateMany({
    where: { user_id: userId, provider: GRAPH_PROVIDER },
    data: { expires_at: 0 },
  });
}
