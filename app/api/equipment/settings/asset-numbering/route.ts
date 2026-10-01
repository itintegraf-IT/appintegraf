import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { canAdministerEquipment } from "@/lib/equipment/access";
import { logEquipmentAuditSafe } from "@/lib/equipment/audit";
import {
  firstAllowedSeriesStart,
  maxSeriesTagInDb,
  readAssetTagSeries,
  saveAssetTagSeriesStart,
  validateSeriesStart,
} from "@/lib/equipment/asset-number";

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
    const current = await readAssetTagSeries(prisma);
    const minAllowed = firstAllowedSeriesStart({
      maxInDb: await maxSeriesTagInDb(prisma),
      lastIssued: current?.lastIssued ?? null,
    });
    const validated = validateSeriesStart((body as { start?: unknown } | null)?.start, minAllowed);
    if (!validated.ok) {
      return NextResponse.json({ error: validated.error }, { status: 400 });
    }

    await saveAssetTagSeriesStart(prisma, validated.start, userId);
    await logEquipmentAuditSafe({
      userId,
      action: "asset_numbering_set",
      tableName: "system_settings",
      oldValues: { start: current?.start ?? null },
      detail: { start: validated.start },
    });
    return NextResponse.json({ ok: true, start: validated.start });
  } catch (e) {
    console.error("asset-numbering PUT:", e);
    return NextResponse.json({ error: "Nastavení se nepodařilo uložit" }, { status: 500 });
  }
}
