import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { canReadStitky } from "@/lib/stitky/access";
import { generateLabels } from "@/lib/stitky/ciselna-rada";
import { orderToInput } from "@/lib/stitky/order-utils";

export const dynamic = "force-dynamic";

type RouteCtx = { params: Promise<{ id: string; row: string }> };

export async function GET(_req: NextRequest, ctx: RouteCtx) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }
  const userId = parseInt(session.user.id, 10);
  if (!(await canReadStitky(userId))) {
    return NextResponse.json({ error: "Nemáte oprávnění" }, { status: 403 });
  }

  const { id, row: rowParam } = await ctx.params;
  const orderId = parseInt(id, 10);
  const rowIndex = parseInt(rowParam, 10);
  if (Number.isNaN(orderId) || Number.isNaN(rowIndex)) {
    return NextResponse.json({ error: "Neplatné parametry" }, { status: 400 });
  }

  const order = await prisma.stitky_orders.findUnique({
    where: { id: orderId },
    include: { rows: { orderBy: { row_index: "asc" } }, template: true },
  });
  if (!order) {
    return NextResponse.json({ error: "Zakázka nenalezena" }, { status: 404 });
  }

  const input = orderToInput(order);
  const row = input.rows.find((r) => r.rowIndex === rowIndex);
  if (!row || row.quantity == null) {
    return NextResponse.json({ error: "Řádek štítku není vyplněn" }, { status: 404 });
  }

  const template = order.template;
  const result = generateLabels(
    row,
    {
      key: template.key,
      sheetKey: template.sheet_key,
      rowStart: template.row_start,
      rowStep: template.row_step,
      rowEnd: template.row_end,
      colStart: template.col_start,
      colStep: template.col_step,
      colEnd: template.col_end,
    },
    order.order_number,
    order.template_key
  );

  return NextResponse.json({
    rowIndex,
    templateKey: order.template_key,
    componentKey: template.component_key,
    ...result,
  });
}
