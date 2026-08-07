import { NextRequest, NextResponse } from "next/server";
import { runImlProductArchiveBatch } from "@/lib/iml-product-archive";

/**
 * Denní / týdenní úloha: archivace neaktivních IML produktových PDF na disk.
 * Volání: POST s hlavičkou Authorization: Bearer <CRON_SECRET>
 *
 * Query:
 * - dryRun=1 — jen seznam kandidátů
 * - limit=20 — max produktů v dávce (1–100)
 * - months=6 — práh neaktivity
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
  const dryRun =
    searchParams.get("dryRun") === "1" || searchParams.get("dry_run") === "1";
  const limitRaw = searchParams.get("limit");
  const monthsRaw = searchParams.get("months");
  const limit = limitRaw ? parseInt(limitRaw, 10) : undefined;
  const inactiveMonths = monthsRaw ? parseInt(monthsRaw, 10) : undefined;

  const result = await runImlProductArchiveBatch({
    dryRun,
    limit: Number.isFinite(limit) ? limit : undefined,
    inactiveMonths: Number.isFinite(inactiveMonths) ? inactiveMonths : undefined,
  });

  return NextResponse.json({
    success: true,
    archiveRoot: process.env.IML_ARCHIVE_DIR?.trim() || "storage/iml-archive",
    ...result,
  });
}
