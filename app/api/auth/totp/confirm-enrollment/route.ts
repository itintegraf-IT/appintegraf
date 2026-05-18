import { NextRequest, NextResponse } from "next/server";
import {
  getUserForEnrollmentChallenge,
  confirmTotpEnrollment,
} from "@/lib/totp-enrollment";
import { logAuthAudit, getRequestIp } from "@/lib/auth-audit";

/** POST /api/auth/totp/confirm-enrollment – aktivace 2FA po naskenování QR. */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({} as Record<string, unknown>));
  const loginChallenge = typeof body.loginChallenge === "string" ? body.loginChallenge : "";
  const code = typeof body.code === "string" ? body.code : "";

  if (!loginChallenge || !code) {
    return NextResponse.json({ error: "Zadejte ověřovací kód z aplikace." }, { status: 400 });
  }

  const user = await getUserForEnrollmentChallenge(loginChallenge);
  if (!user) {
    return NextResponse.json({ error: "Neplatná relace. Přihlaste se znovu." }, { status: 403 });
  }

  const result = await confirmTotpEnrollment(user.id, code);
  if (!result) {
    const ip = await getRequestIp();
    await logAuthAudit({
      userId: user.id,
      targetUserId: user.id,
      action: "totp_login_failed",
      ipAddress: ip,
      details: { phase: "enrollment" },
    });
    return NextResponse.json({ error: "Neplatný ověřovací kód." }, { status: 400 });
  }

  const ip = await getRequestIp();
  await logAuthAudit({
    userId: user.id,
    targetUserId: user.id,
    action: "totp_enrolled_by_user",
    ipAddress: ip,
  });

  return NextResponse.json({ ok: true, backupCodes: result.backupCodes });
}
