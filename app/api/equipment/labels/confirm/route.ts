import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { canManageRegister, canWriteEquipment } from "@/lib/equipment/access";
import { logEquipmentAudit } from "@/lib/equipment/audit";
import { parseLabelIds, splitPrintable } from "@/lib/equipment/label-plan";

const iso = (d: Date | null) => (d ? d.toISOString() : null);

/**
 * Potvrzení, že se štítky opravdu vytiskly (nebo zrušení potvrzení). Teprve tady
 * se zapíše `label_printed_at` — samotné vygenerování PDF nic nemění.
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }
  const userId = parseInt(session.user.id, 10);

  const body = (await req.json().catch(() => ({}))) as { kind?: unknown; ids?: unknown; printed?: unknown };
  const kind = body.kind === "item" || body.kind === "room" ? body.kind : null;
  if (!kind) return NextResponse.json({ error: "Neplatný druh štítku" }, { status: 400 });
  const printed = body.printed !== false;
  const parsedIds = parseLabelIds(body.ids);
  if (!parsedIds.ok) return NextResponse.json({ error: parsedIds.error }, { status: 400 });
  const action = printed ? "labels_printed" : "labels_unprinted";
  const now = new Date();

  try {
    if (kind === "item") {
      const items = await prisma.equipment_items.findMany({
        where: { id: { in: parsedIds.ids } },
        select: { id: true, category_id: true, qr_code: true, label_printed_at: true },
      });
      for (const categoryId of new Set(items.map((i) => i.category_id))) {
        if (!(await canWriteEquipment(userId, categoryId))) {
          return NextResponse.json({ error: "Nemáte oprávnění ke všem vybraným položkám" }, { status: 403 });
        }
      }
      const { printable, skipped } = splitPrintable(items);
      if (printable.length === 0) {
        return NextResponse.json({ error: "Vybrané položky nemají QR kód" }, { status: 400 });
      }
      const ids = printable.map((i) => i.id);
      await prisma.$transaction(
        async (tx) => {
          await tx.equipment_items.updateMany({
            where: { id: { in: ids } },
            data: { label_printed_at: printed ? now : null },
          });
          await logEquipmentAudit(
            {
              userId,
              action,
              tableName: "equipment_items",
              detail: { count: ids.length, ids, label_printed_at: printed ? now.toISOString() : null },
              oldValues: { label_printed_at: Object.fromEntries(printable.map((i) => [i.id, iso(i.label_printed_at)])) },
            },
            tx
          );
        },
        { maxWait: 5000, timeout: 20000 }
      );
      return NextResponse.json({
        updated: ids.length,
        skipped: skipped.length + (parsedIds.ids.length - items.length),
      });
    }

    if (!(await canManageRegister(userId))) {
      return NextResponse.json({ error: "Nemáte oprávnění" }, { status: 403 });
    }
    const rooms = await prisma.equipment_rooms.findMany({
      where: { id: { in: parsedIds.ids } },
      select: { id: true, label_printed_at: true },
    });
    if (rooms.length === 0) return NextResponse.json({ error: "Místnosti nenalezeny" }, { status: 404 });
    const ids = rooms.map((r) => r.id);
    await prisma.$transaction(
      async (tx) => {
        await tx.equipment_rooms.updateMany({
          where: { id: { in: ids } },
          data: { label_printed_at: printed ? now : null },
        });
        await logEquipmentAudit(
          {
            userId,
            action,
            tableName: "equipment_rooms",
            detail: { count: ids.length, ids, label_printed_at: printed ? now.toISOString() : null },
            oldValues: { label_printed_at: Object.fromEntries(rooms.map((r) => [r.id, iso(r.label_printed_at)])) },
          },
          tx
        );
      },
      { maxWait: 5000, timeout: 20000 }
    );
    return NextResponse.json({ updated: ids.length, skipped: parsedIds.ids.length - rooms.length });
  } catch (e) {
    console.error("[labels/confirm]", e);
    if (e instanceof Prisma.PrismaClientKnownRequestError && (e.code === "P2028" || e.code === "P2034")) {
      return NextResponse.json({ error: "Server je teď vytížený. Zkuste to prosím znovu." }, { status: 503 });
    }
    return NextResponse.json({ error: "Potvrzení se nepodařilo uložit" }, { status: 500 });
  }
}
