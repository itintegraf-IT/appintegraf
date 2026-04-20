import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyUserToken, tokenReasonText, type TokenPurpose } from "@/lib/tokens";

/**
 * GET /api/auth/validate-token?token=...&purpose=password_reset|account_activation
 * Používá stránka /reset-password a /activate k ověření platnosti odkazu
 * ještě před zobrazením formuláře.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get("token") ?? "";
  const purposeParam = searchParams.get("purpose");

  if (purposeParam !== "password_reset" && purposeParam !== "account_activation") {
    return NextResponse.json({ ok: false, error: "Neplatný typ odkazu" }, { status: 400 });
  }
  const purpose = purposeParam as TokenPurpose;

  const result = await verifyUserToken(token, purpose);
  if (!result.ok) {
    return NextResponse.json(
      { ok: false, error: tokenReasonText(result.reason) },
      { status: 400 }
    );
  }

  const user = await prisma.users.findUnique({
    where: { id: result.userId },
    select: { username: true, email: true, first_name: true, last_name: true, is_active: true },
  });
  if (!user || user.is_active === false) {
    return NextResponse.json(
      { ok: false, error: "Účet není dostupný" },
      { status: 400 }
    );
  }

  return NextResponse.json({
    ok: true,
    user: {
      username: user.username,
      email: user.email,
      first_name: user.first_name,
      last_name: user.last_name,
    },
  });
}
