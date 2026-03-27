import { NextRequest, NextResponse } from "next/server";
import { runContractExpiryReminders } from "@/lib/contracts/expiry-reminders";

/**
 * Denní úloha: upozornění na blížící se konec platnosti (in-app notifikace).
 * Volání: POST s hlavičkou Authorization: Bearer &lt;CRON_SECRET&gt;
 * Proměnná prostředí: CRON_SECRET (pokud chybí, endpoint vrací 503).
 *
 * Volitelně: ?days=90 (výchozí 90) – horizont pro výběr smluv.
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

  const { searchParams } = new URL(req.url);
  const daysRaw = searchParams.get("days");
  const days = Math.min(
    Math.max(parseInt(daysRaw ?? "90", 10) || 90, 1),
    365
  );

  const result = await runContractExpiryReminders(days);

  return NextResponse.json({
    success: true,
    horizonDays: days,
    ...result,
  });
}
