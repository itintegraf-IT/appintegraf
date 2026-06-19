import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { canPrintStitky } from "@/lib/stitky/access";
import { logStitkyAudit } from "@/lib/stitky/audit";
import { notifyStitkyCreatorPrinted } from "@/lib/stitky-notify";
import { assertTemplateReady, updateOrderStatus } from "@/lib/stitky/order-utils";

export const dynamic = "force-dynamic";

type RouteCtx = { params: Promise<{ id: string; row: string }> };

/** Označí tisk řádku (audit + stav PRINTED) — voláno z náhledu před window.print(). */
export async function POST(_req: NextRequest, ctx: RouteCtx) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }
  const userId = parseInt(session.user.id, 10);
  if (!(await canPrintStitky(userId))) {
    return NextResponse.json({ error: "Nemáte oprávnění" }, { status: 403 });
  }

  const { id, row: rowParam } = await ctx.params;
  const orderId = parseInt(id, 10);
  const rowIndex = parseInt(rowParam, 10);
  if (Number.isNaN(orderId) || Number.isNaN(rowIndex)) {
    return NextResponse.json({ error: "Neplatné parametry" }, { status: 400 });
  }

  const order = await prisma.stitky_orders.findUnique({ where: { id: orderId } });
  if (!order) {
    return NextResponse.json({ error: "Zakázka nenalezena" }, { status: 404 });
  }

  const templateCheck = await assertTemplateReady(order.template_key);
  if (!templateCheck.ok) {
    return NextResponse.json({ error: templateCheck.error }, { status: 400 });
  }

  const wasPrinted = order.status === "PRINTED" || order.status === "DONE";

  if (order.status !== "DONE" && order.status !== "PRINTED") {
    await updateOrderStatus(orderId, userId, "PRINTED");
  }
  await logStitkyAudit({
    userId,
    orderId,
    action: "PRINTED",
    detail: { row: rowIndex, output: "Tisk" },
  });

  if (!wasPrinted) {
    await notifyStitkyCreatorPrinted({
      orderId,
      orderNumber: order.order_number,
      creatorUserId: order.created_by,
      actorUserId: userId,
    });
  }

  return NextResponse.json({ ok: true });
}
