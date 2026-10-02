import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { canAdministerEquipment } from "@/lib/equipment/access";
import { logEquipmentAuditSafe } from "@/lib/equipment/audit";
import { setAssetTagSeriesStart } from "@/lib/equipment/asset-number";

/** Nastaví start číselné řady inventárních čísel (jen správce modulu). */
export async function PUT(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }
  const userId = parseInt(session.user.id, 10);
  if (!(await canAdministerEquipment(userId))) {
    return NextResponse.json({ error: "Nemáte oprávnění" }, { status: 403 });
  }

  const body: unknown = await req.json().catch(() => ({}));
  try {
    // Pod zámkem řady: souběžné zařazení nákupu nesmí přepsat poslední vydané číslo.
    const result = await prisma.$transaction(
      (tx) => setAssetTagSeriesStart(tx, (body as { start?: unknown } | null)?.start, userId),
      { maxWait: 5000, timeout: 20000 }
    );
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    const lastIssued = result.previous?.lastIssued ?? null;
    await logEquipmentAuditSafe({
      userId,
      action: "asset_numbering_set",
      tableName: "system_settings",
      oldValues: { start: result.previous?.start ?? null, lastIssued },
      detail: { start: result.start, lastIssued },
    });
    return NextResponse.json({ ok: true, start: result.start });
  } catch (e) {
    console.error("asset-numbering PUT:", e);
    return NextResponse.json({ error: "Nastavení se nepodařilo uložit" }, { status: 500 });
  }
}
