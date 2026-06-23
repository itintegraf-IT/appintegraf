import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { canSubmitStitky } from "@/lib/stitky/access";
import { logStitkyAudit } from "@/lib/stitky/audit";
import { sendStitkySubmitEmail } from "@/lib/stitky/notify";
import { notifyStitkySubmittedToRoles } from "@/lib/stitky-notify";
import { assertTemplateReady, orderToInput, updateOrderStatus } from "@/lib/stitky/order-utils";
import { validateOrderInput } from "@/lib/stitky/validators/order";

export const dynamic = "force-dynamic";

type RouteCtx = { params: Promise<{ id: string }> };

export async function POST(_req: NextRequest, ctx: RouteCtx) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }
  const userId = parseInt(session.user.id, 10);
  if (!(await canSubmitStitky(userId))) {
    return NextResponse.json({ error: "Nemáte oprávnění" }, { status: 403 });
  }

  const orderId = parseInt((await ctx.params).id, 10);
  if (Number.isNaN(orderId)) {
    return NextResponse.json({ error: "Neplatné ID" }, { status: 400 });
  }

  const order = await prisma.stitky_orders.findUnique({
    where: { id: orderId },
    include: { rows: { orderBy: { row_index: "asc" } } },
  });
  if (!order) {
    return NextResponse.json({ error: "Zakázka nenalezena" }, { status: 404 });
  }

  const templateCheck = await assertTemplateReady(order.template_key);
  if (!templateCheck.ok) {
    return NextResponse.json({ error: templateCheck.error }, { status: 400 });
  }

  const errors = validateOrderInput(orderToInput(order));
  if (errors.length > 0) {
    return NextResponse.json({ error: "Validace selhala", errors }, { status: 400 });
  }

  const updated = await updateOrderStatus(orderId, userId, "SUBMITTED");

  const username = session.user.name ?? session.user.email ?? "uživatel";
  await sendStitkySubmitEmail({
    orderNumber: order.order_number,
    submittedBy: username,
    channel: "mailing",
  });
  await notifyStitkySubmittedToRoles({
    orderId,
    orderNumber: order.order_number,
    submittedByUserId: userId,
    submittedByName: username,
    channel: "mailing",
  });
  await logStitkyAudit({ userId, orderId, action: "SUBMITTED" });

  return NextResponse.json({ order: updated });
}
