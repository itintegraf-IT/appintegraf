import { NextRequest, NextResponse } from "next/server";
import { runTrainingDeadlineReminders } from "@/lib/training/notify";

/**
 * Denní úloha: připomínky termínů testů (in-app notifikace).
 * Volání: POST s hlavičkou Authorization: Bearer &lt;CRON_SECRET&gt;
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
  if (token !== secret) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }

  const result = await runTrainingDeadlineReminders();
  return NextResponse.json({ success: true, ...result });
}
