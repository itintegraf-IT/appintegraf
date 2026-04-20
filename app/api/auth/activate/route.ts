import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import {
  verifyUserToken,
  consumeUserToken,
  tokenReasonText,
} from "@/lib/tokens";
import { validatePassword } from "@/lib/password-policy";
import { sendPasswordChangedEmail } from "@/lib/email";
import { logAuthAudit } from "@/lib/auth-audit";

/**
 * POST /api/auth/activate
 * Body: { token: string, password: string }
 * Stejné chování jako /reset-password, ale pro `account_activation` token.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({} as Record<string, unknown>));
  const token = typeof body.token === "string" ? body.token : "";
  const password = typeof body.password === "string" ? body.password : "";

  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    null;

  const validation = validatePassword(password);
  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  const verified = await verifyUserToken(token, "account_activation");
  if (!verified.ok) {
    return NextResponse.json(
      { error: tokenReasonText(verified.reason) },
      { status: 400 }
    );
  }

  const user = await prisma.users.findUnique({ where: { id: verified.userId } });
  if (!user) {
    return NextResponse.json({ error: "Účet není dostupný" }, { status: 400 });
  }

  const passwordHash = await bcrypt.hash(password, 10);

  await prisma.users.update({
    where: { id: user.id },
    data: {
      password_hash: passwordHash,
      password_custom: null,
      password_version: { increment: 1 },
      // Pokud byl uživatel při vytvoření neaktivní kvůli čekání na aktivaci, zapni ho
      is_active: true,
      updated_at: new Date(),
    },
  });

  await consumeUserToken(verified.tokenId, ip);

  sendPasswordChangedEmail({
    toEmail: user.email,
    toName: `${user.first_name} ${user.last_name}`.trim() || user.username,
    when: new Date(),
    ip,
  }).catch(() => {});

  await logAuthAudit({
    userId: user.id,
    targetUserId: user.id,
    action: "account_activated",
    details: { ip },
  });

  return NextResponse.json({ ok: true, username: user.username });
}
