import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { hasModuleAccess } from "@/lib/auth-utils";
import { buildImlOrderXml } from "@/lib/iml-xml";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }

  const userId = parseInt(session.user.id, 10);
  if (!(await hasModuleAccess(userId, "iml", "read"))) {
    return NextResponse.json({ error: "Nemáte oprávnění k modulu IML" }, { status: 403 });
  }

  const id = parseInt((await params).id, 10);
  if (isNaN(id)) {
    return NextResponse.json({ error: "Neplatné ID" }, { status: 400 });
  }

  const order = await prisma.iml_orders.findUnique({
    where: { id },
    include: {
      iml_customers: { select: { name: true, email: true, phone: true } },
      iml_order_items: {
        include: {
          iml_products: {
            select: { ig_code: true, ig_short_name: true, client_name: true },
          },
        },
      },
    },
  });

  if (!order) {
    return NextResponse.json({ error: "Objednávka nenalezena" }, { status: 404 });
  }

  const xml = buildImlOrderXml(order);
  const safeName = order.order_number.replace(/[^\w.-]+/g, "_");

  return new NextResponse(xml, {
    status: 200,
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Content-Disposition": `attachment; filename="iml-order-${safeName}.xml"`,
    },
  });
}
