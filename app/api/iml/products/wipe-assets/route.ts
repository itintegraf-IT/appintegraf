import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { hasModuleAccess } from "@/lib/auth-utils";
import { logImlAudit } from "@/lib/iml-audit";
import {
  getWipeAssetsStats,
  normalizeWipeStatuses,
  runImlWipeAssetsBatch,
} from "@/lib/iml-product-wipe-assets";

/**
 * Admin: hromadné smazání tiskových PDF + softproof u produktů
 * ve stavech zablokovaná / neaktivní / chyba (výběr přes statuses[]).
 * GET  – statistiky
 * POST – { dryRun?: boolean, limit?: number, statuses?: string[] }
 */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }
  const userId = parseInt(session.user.id, 10);
  if (!(await hasModuleAccess(userId, "iml", "admin"))) {
    return NextResponse.json({ error: "Jen administrátor IML" }, { status: 403 });
  }

  const stats = await getWipeAssetsStats();
  return NextResponse.json(stats);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }
  const userId = parseInt(session.user.id, 10);
  if (!(await hasModuleAccess(userId, "iml", "admin"))) {
    return NextResponse.json({ error: "Jen administrátor IML" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const dryRun = body?.dryRun === true || body?.dry_run === true;
  const limit =
    body?.limit != null ? parseInt(String(body.limit), 10) : undefined;

  if (Array.isArray(body?.statuses) && body.statuses.length > 0) {
    const selected = normalizeWipeStatuses(body.statuses);
    if (selected.length === 0) {
      return NextResponse.json(
        {
          error:
            "Neplatný výběr stavů. Povoleno: zablokovaná, neaktivní, chyba.",
        },
        { status: 400 }
      );
    }
  }

  const result = await runImlWipeAssetsBatch({
    dryRun,
    limit: Number.isFinite(limit) ? limit : undefined,
    statuses: Array.isArray(body?.statuses) ? body.statuses : undefined,
  });

  if (!dryRun && result.processed.length > 0) {
    const wiped = result.processed.filter((p) => !p.skippedReason);
    await logImlAudit({
      userId,
      action: "update",
      tableName: "iml_products",
      recordId: wiped[0]?.productId ?? result.candidateIds[0] ?? 0,
      newValues: {
        wipe_print_assets_batch: true,
        selected_statuses: result.selectedStatuses,
        candidate_ids: result.candidateIds,
        products_wiped: wiped.length,
        files_deleted: result.totalFilesDeleted,
        bytes_freed: result.totalBytesFreed,
      },
    });

    for (const p of wiped) {
      await logImlAudit({
        userId,
        action: "update",
        tableName: "iml_products",
        recordId: p.productId,
        newValues: {
          print_assets_wiped: true,
          files_deleted: p.filesDeleted,
          cleared_image: p.clearedImage,
          cleared_legacy_pdf: p.clearedLegacyPdf,
        },
      });
    }
  }

  return NextResponse.json({ success: true, ...result });
}
