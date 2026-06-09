import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { AppError } from "@/lib/crm/errors";
import {
  getMicrosoftEntraConfig,
  GRAPH_OAUTH_SCOPES,
  getGraphCallbackUrl,
  GRAPH_PROVIDER,
} from "@/lib/crm/graph/config";
import { verifyOAuthState } from "@/lib/crm/graph/oauth-state";

export async function GET(req: NextRequest) {
  const redirectOk = () =>
    NextResponse.redirect(new URL("/crm/settings/integrations?connected=1", req.nextUrl.origin));
  const redirectErr = (msg: string) =>
    NextResponse.redirect(
      new URL(`/crm/settings/integrations?error=${encodeURIComponent(msg)}`, req.nextUrl.origin)
    );

  try {
    const code = req.nextUrl.searchParams.get("code");
    const state = req.nextUrl.searchParams.get("state");
    const msError = req.nextUrl.searchParams.get("error_description") ?? req.nextUrl.searchParams.get("error");

    if (msError) return redirectErr(String(msError).slice(0, 200));
    if (!code || !state) return redirectErr("Chybí OAuth parametry.");

    const userId = verifyOAuthState(state);
    const cfg = getMicrosoftEntraConfig();
    if (!cfg) return redirectErr("Microsoft Entra není nakonfigurováno.");

    const tokenBody = new URLSearchParams({
      client_id: cfg.clientId,
      client_secret: cfg.clientSecret,
      grant_type: "authorization_code",
      code,
      redirect_uri: getGraphCallbackUrl(),
      scope: GRAPH_OAUTH_SCOPES,
    });

    const tokenResp = await fetch(cfg.tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: tokenBody,
    });

    if (!tokenResp.ok) {
      const text = await tokenResp.text();
      return redirectErr(`Token exchange selhal: ${text.slice(0, 120)}`);
    }

    const tokens = (await tokenResp.json()) as {
      access_token: string;
      refresh_token?: string;
      expires_in: number;
      token_type?: string;
      scope?: string;
    };

    if (!tokens.access_token || !tokens.refresh_token) {
      return redirectErr("Microsoft nevrátil refresh token.");
    }

    const meResp = await fetch("https://graph.microsoft.com/v1.0/me?$select=id,mail,userPrincipalName", {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    if (!meResp.ok) return redirectErr("Nepodařilo se načíst profil z Graph API.");

    const me = (await meResp.json()) as { id: string; mail?: string; userPrincipalName?: string };
    const providerAccountId = me.id;
    if (!providerAccountId) return redirectErr("Graph profil bez ID.");

    const expiresAt = Math.floor(Date.now() / 1000) + (tokens.expires_in ?? 3600);

    await prisma.crm_graph_accounts.upsert({
      where: {
        provider_provider_account_id: {
          provider: GRAPH_PROVIDER,
          provider_account_id: providerAccountId,
        },
      },
      create: {
        user_id: userId,
        provider: GRAPH_PROVIDER,
        provider_account_id: providerAccountId,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expires_at: expiresAt,
        token_type: tokens.token_type,
        scope: tokens.scope,
      },
      update: {
        user_id: userId,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expires_at: expiresAt,
        token_type: tokens.token_type,
        scope: tokens.scope,
      },
    });

    await prisma.crm_graph_sync_state.upsert({
      where: { user_id: userId },
      update: { enabled: true, last_error_msg: null, error_count: 0, backoff_until: null },
      create: { user_id: userId, enabled: true },
    });

    return redirectOk();
  } catch (err) {
    const msg = err instanceof AppError ? err.message : "Neočekávaná chyba OAuth.";
    return redirectErr(msg);
  }
}
