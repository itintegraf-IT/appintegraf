import { NextRequest, NextResponse } from "next/server";
import { requireCrmAdmin } from "@/lib/crm/guards";
import { withApiError } from "@/lib/crm/api-utils";
import { AppError } from "@/lib/crm/errors";
import { prisma } from "@/lib/db";
import {
  getMicrosoftEntraConfig,
  GRAPH_OAUTH_SCOPES,
  getGraphCallbackUrl,
} from "@/lib/crm/graph/config";
import { signOAuthState } from "@/lib/crm/graph/oauth-state";

export const GET = withApiError(async (req: NextRequest) => {
  await requireCrmAdmin();

  const cfg = getMicrosoftEntraConfig();
  if (!cfg) {
    throw new AppError("INTERNAL", "Microsoft Entra není nakonfigurováno.");
  }

  const userIdRaw = req.nextUrl.searchParams.get("userId");
  const userId = userIdRaw ? parseInt(userIdRaw, 10) : NaN;
  if (Number.isNaN(userId) || userId <= 0) {
    throw new AppError("VALIDATION", "Chybí platné userId.");
  }

  const user = await prisma.users.findFirst({
    where: { id: userId, OR: [{ is_active: true }, { is_active: null }] },
    select: { id: true },
  });
  if (!user) throw new AppError("NOT_FOUND", "Uživatel nenalezen.");

  const state = signOAuthState(userId);
  const params = new URLSearchParams({
    client_id: cfg.clientId,
    response_type: "code",
    redirect_uri: getGraphCallbackUrl(),
    response_mode: "query",
    scope: GRAPH_OAUTH_SCOPES,
    state,
    prompt: "consent",
  });

  return NextResponse.redirect(`${cfg.authorizeUrl}?${params.toString()}`);
});
