import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { hasModuleAccess } from "@/lib/auth-utils";
import { logImlAudit } from "@/lib/iml-audit";
import { reactivateProduct } from "@/lib/iml-product-archive";

/**
 * Admin: reaktivace produktu z archivu mezi „hot“ metadata.
 * POST body: { restoreToHot?: boolean }
 * - restoreToHot=false (výchozí): zruší archived_at, PDF zůstane na disku
 * - restoreToHot=true: navíc zkopíruje PDF z disku zpět do MySQL BLOB
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }

  const userId = parseInt(session.user.id, 10);
  if (!(await hasModuleAccess(userId, "iml", "admin"))) {
    return NextResponse.json(
      { error: "Reaktivaci archivu může provést jen administrátor IML" },
      { status: 403 }
    );
  }

  const id = parseInt((await params).id, 10);
  if (isNaN(id)) {
    return NextResponse.json({ error: "Neplatné ID" }, { status: 400 });
  }

  const existing = await prisma.iml_products.findUnique({
    where: { id },
    select: { id: true, archived_at: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "Produkt nenalezen" }, { status: 404 });
  }
  if (!existing.archived_at) {
    return NextResponse.json({ error: "Produkt není v archivu" }, { status: 400 });
  }

  let restoreToHot = false;
  try {
    const body = await req.json().catch(() => ({}));
    restoreToHot = body?.restoreToHot === true || body?.restore_to_hot === true;
  } catch {
    restoreToHot = false;
  }

  try {
    const result = await reactivateProduct(id, { restoreToHot });
    await logImlAudit({
      userId,
      action: "update",
      tableName: "iml_products",
      recordId: id,
      newValues: {
        archived_at: null,
        restoreToHot,
        filesRestored: result.filesRestored,
        legacyRestored: result.legacyRestored,
      },
    });
    return NextResponse.json({ success: true, ...result });
  } catch (e) {
    console.error("IML product reactivate error:", e);
    const msg = e instanceof Error ? e.message : "Chyba při reaktivaci";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
