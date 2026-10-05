import { NextRequest, NextResponse } from "next/server";
import { runMaketySoftproofReminders } from "@/lib/makety-softproof-reminders";

/**
 * Denní úloha: připomínky softproofu klientovi po vypršení odkazu.
 * Volání: POST s hlavičkou Authorization: Bearer <CRON_SECRET>
 */
export async function POST(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || secret.length < 8) {
    return NextResponse.json(
      { error: "CRON_SECRET není nastaven v prostředí." },
      { status: 503 }
    );
  }

  const auth = req.headers.get("authorization");
  const token = auth?.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  const querySecret = req.nextUrl.searchParams.get("secret")?.trim() ?? "";
  if (token !== secret && querySecret !== secret) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }

  const result = await runMaketySoftproofReminders();
  return NextResponse.json({ success: true, ...result });
}

export async function GET(req: NextRequest) {
  return POST(req);
}
