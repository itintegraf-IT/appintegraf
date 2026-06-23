import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { canCompleteStitky } from "@/lib/stitky/access";
import { logStitkyAudit } from "@/lib/stitky/audit";
import { sendStitkyDoneEmail } from "@/lib/stitky/notify";
import { notifyStitkyCreatorDone } from "@/lib/stitky-notify";
import { updateOrderStatus } from "@/lib/stitky/order-utils";

export const dynamic = "force-dynamic";

type RouteCtx = { params: Promise<{ id: string }> };

export async function POST(_req: NextRequest, ctx: RouteCtx) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }
  const userId = parseInt(session.user.id, 10);
  if (!(await canCompleteStitky(userId))) {
    return NextResponse.json({ error: "Nemáte oprávnění" }, { status: 403 });
  }

  const orderId = parseInt((await ctx.params).id, 10);
  if (Number.isNaN(orderId)) {
    return NextResponse.json({ error: "Neplatné ID" }, { status: 400 });
  }

  const order = await prisma.stitky_orders.findUnique({ where: { id: orderId } });
  if (!order) {
    return NextResponse.json({ error: "Zakázka nenalezena" }, { status: 404 });
  }

  const updated = await updateOrderStatus(orderId, userId, "DONE");

  const username = session.user.name ?? session.user.email ?? "uživatel";
  await sendStitkyDoneEmail({ orderNumber: order.order_number, processedBy: username });
  await logStitkyAudit({ userId, orderId, action: "DONE" });
  await notifyStitkyCreatorDone({
    orderId,
    orderNumber: order.order_number,
    creatorUserId: order.created_by,
    actorUserId: userId,
  });

  return NextResponse.json({ order: updated });
}
