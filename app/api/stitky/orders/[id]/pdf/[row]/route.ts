import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { canPrintStitky } from "@/lib/stitky/access";
import { logStitkyAudit } from "@/lib/stitky/audit";
import { notifyStitkyCreatorPrinted } from "@/lib/stitky-notify";
import { buildLabelsPdfForOrder } from "@/lib/stitky/pdf-labels";
import { assertTemplateReady, orderToInput, updateOrderStatus } from "@/lib/stitky/order-utils";

export const dynamic = "force-dynamic";

type RouteCtx = { params: Promise<{ id: string; row: string }> };

export async function GET(_req: NextRequest, ctx: RouteCtx) {
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

  try {
    const order = await prisma.stitky_orders.findUnique({
      where: { id: orderId },
      include: { rows: { orderBy: { row_index: "asc" } }, template: true },
    });
    if (!order) {
      return NextResponse.json({ error: "Zakázka nenalezena" }, { status: 404 });
    }

    const templateCheck = await assertTemplateReady(order.template_key);
    if (!templateCheck.ok) {
      return NextResponse.json({ error: templateCheck.error }, { status: 400 });
    }

    const input = orderToInput(order);
    const labelRow = input.rows.find((r) => r.rowIndex === rowIndex);
    if (!labelRow?.quantity) {
      return NextResponse.json({ error: "Řádek není vyplněn" }, { status: 404 });
    }

    const t = order.template;
    const { bytes, filename } = await buildLabelsPdfForOrder(
      order.order_number,
      order.template_key,
      t.component_key,
      {
        key: t.key,
        sheetKey: t.sheet_key,
        rowStart: t.row_start,
        rowStep: t.row_step,
        rowEnd: t.row_end,
        colStart: t.col_start,
        colStep: t.col_step,
        colEnd: t.col_end,
      },
      labelRow,
      rowIndex
    );

    const wasPrinted = order.status === "PRINTED" || order.status === "DONE";

    if (order.status !== "DONE" && order.status !== "PRINTED") {
      await updateOrderStatus(orderId, userId, "PRINTED");
    }
    await logStitkyAudit({
      userId,
      orderId,
      action: "PDF_EXPORT",
      detail: { row: rowIndex, filename },
    });

    if (!wasPrinted) {
      await notifyStitkyCreatorPrinted({
        orderId,
        orderNumber: order.order_number,
        creatorUserId: order.created_by,
        actorUserId: userId,
      });
    }

    const encoded = encodeURIComponent(filename);

    return new NextResponse(Buffer.from(bytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"; filename*=UTF-8''${encoded}`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    console.error("GET /api/stitky/orders/[id]/pdf/[row]", e);
    return NextResponse.json({ error: "Generování PDF selhalo" }, { status: 500 });
  }
}
