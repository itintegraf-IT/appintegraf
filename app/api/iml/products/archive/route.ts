import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { hasModuleAccess } from "@/lib/auth-utils";
import {
  getImlArchiveRoot,
  IML_ARCHIVE_INACTIVE_MONTHS,
  runImlProductArchiveBatch,
} from "@/lib/iml-product-archive";

/**
 * Admin: stav archivu IML produktů + dry-run / ostrý běh dávky.
 * GET  – statistiky
 * POST – { dryRun?: boolean, limit?: number, months?: number }
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

  const [archivedCount, activeWithHotPdf] = await Promise.all([
    prisma.iml_products.count({ where: { archived_at: { not: null } } }),
    prisma.$queryRaw<Array<{ cnt: bigint }>>`
      SELECT COUNT(*) AS cnt
      FROM iml_products p
      WHERE p.archived_at IS NULL
        AND (
          (p.pdf_data IS NOT NULL AND OCTET_LENGTH(p.pdf_data) > 0)
          OR EXISTS (
            SELECT 1 FROM iml_product_files f
            WHERE f.product_id = p.id
              AND f.pdf_data IS NOT NULL
              AND OCTET_LENGTH(f.pdf_data) > 0
          )
        )
    `,
  ]);

  const root = getImlArchiveRoot();
  const envSet = Boolean(process.env.IML_ARCHIVE_DIR?.trim());

  return NextResponse.json({
    archiveRoot: root,
    archiveRootFromEnv: envSet,
    inactiveMonths: IML_ARCHIVE_INACTIVE_MONTHS,
    archivedProducts: archivedCount,
    productsWithHotPdf: Number(activeWithHotPdf[0]?.cnt ?? 0),
  });
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
  const months =
    body?.months != null ? parseInt(String(body.months), 10) : undefined;

  const result = await runImlProductArchiveBatch({
    dryRun,
    limit: Number.isFinite(limit) ? limit : undefined,
    inactiveMonths: Number.isFinite(months) ? months : undefined,
  });

  return NextResponse.json({ success: true, ...result });
}
