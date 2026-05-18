import { NextRequest, NextResponse } from "next/server";
import { getUserForEnrollmentChallenge, prepareTotpEnrollment } from "@/lib/totp-enrollment";

/** POST /api/auth/totp/enroll – QR kód pro dokončení 2FA (po ověření hesla + challenge). */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({} as Record<string, unknown>));
  const loginChallenge = typeof body.loginChallenge === "string" ? body.loginChallenge : "";

  if (!loginChallenge) {
    return NextResponse.json({ error: "Neplatná relace. Přihlaste se znovu." }, { status: 400 });
  }

  const user = await getUserForEnrollmentChallenge(loginChallenge);
  if (!user) {
    return NextResponse.json({ error: "Neplatná relace. Přihlaste se znovu." }, { status: 403 });
  }

  const prepared = await prepareTotpEnrollment(user.id);
  if (!prepared) {
    return NextResponse.json({ error: "Nepodařilo se připravit 2FA." }, { status: 500 });
  }

  return NextResponse.json({ qrDataUrl: prepared.qrDataUrl });
}
