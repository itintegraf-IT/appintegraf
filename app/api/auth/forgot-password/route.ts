import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { createUserToken } from "@/lib/tokens";
import { sendPasswordResetEmail } from "@/lib/email";
import { rateLimit } from "@/lib/rate-limit";
import { logAuthAudit } from "@/lib/auth-audit";

/**
 * POST /api/auth/forgot-password
 * Body: { login: string } – username nebo e-mail.
 * Vrací vždy stejnou odpověď (neprozrazuje existenci účtu).
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({} as Record<string, unknown>));
  const login = typeof body.login === "string" ? body.login.trim() : "";

  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    null;

  // Rate-limit: per-IP – ochrana před spamem / enumerací
  const ipLimit = await rateLimit({
    key: `forgot:ip:${ip ?? "unknown"}`,
    max: 10,
    windowMs: 60 * 60 * 1000,
  });
  if (!ipLimit.allowed) {
    return NextResponse.json(
      { error: "Příliš mnoho pokusů. Zkuste to prosím za chvíli znovu." },
      { status: 429, headers: { "Retry-After": String(ipLimit.retryAfterSeconds) } }
    );
  }

  // Generic odpověď; i kdyby user neexistoval
  const genericResponse = NextResponse.json({
    ok: true,
    message:
      "Pokud účet s těmito údaji existuje, odeslali jsme na jeho e-mail odkaz pro obnovu hesla.",
  });

  if (!login) return genericResponse;

  const user = await prisma.users.findFirst({
    where: { OR: [{ username: login }, { email: login }] },
  });

  if (!user || user.is_active === false) {
    return genericResponse;
  }

  const userLimit = await rateLimit({
    key: `forgot:user:${user.id}`,
    max: 3,
    windowMs: 60 * 60 * 1000,
  });
  if (!userLimit.allowed) {
    await logAuthAudit({
      userId: null,
      targetUserId: user.id,
      action: "password_reset_rate_limited",
      details: { source: "forgot", ip },
    });
    return genericResponse;
  }

  const { token, expiresAt } = await createUserToken({
    userId: user.id,
    purpose: "password_reset",
    ip,
  });

  await sendPasswordResetEmail({
    toEmail: user.email,
    toName: `${user.first_name} ${user.last_name}`.trim() || user.username,
    token,
    expiresAt,
  });

  await logAuthAudit({
    userId: null,
    targetUserId: user.id,
    action: "password_reset_requested",
    details: { source: "self_service", ip },
  });

  return genericResponse;
}
