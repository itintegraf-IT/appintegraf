import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { canAccessMaketyModule } from "@/lib/makety-module-access";

/**
 * Lookup IML katalogu pro formuláře grafiky (oprávnění = modul Makety).
 * GET ?type=customers|products|die_cuts&customer_id=&q=
 */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }
  const userId = parseInt(session.user.id, 10);
  if (!(await canAccessMaketyModule(userId))) {
    return NextResponse.json({ error: "Nemáte oprávnění" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type") ?? "customers";
  const q = (searchParams.get("q") ?? searchParams.get("search") ?? "").trim();
  const customerIdRaw = searchParams.get("customer_id");
  const customerId = customerIdRaw ? parseInt(customerIdRaw, 10) : null;

  if (type === "customers") {
    const idRaw = searchParams.get("id");
    const ensureId = idRaw ? parseInt(idRaw, 10) : null;
    /** roots = jen centrály (výchozí, stejně jako IML katalog); all = včetně poboček */
    const scope = (searchParams.get("scope") ?? "roots").trim().toLowerCase();
    const where: Prisma.iml_customersWhereInput = {};
    if (scope !== "all") {
      where.parent_id = null;
    }
    if (q) {
      where.OR = [
        { name: { contains: q } },
        { ico: { contains: q } },
        { email: { contains: q } },
      ];
    }
    const customers = await prisma.iml_customers.findMany({
      where,
      orderBy: [{ name: "asc" }],
      take: 500,
      select: { id: true, name: true, email: true, unit_type: true, parent_id: true },
    });
    if (ensureId != null && !Number.isNaN(ensureId) && !customers.some((c) => c.id === ensureId)) {
      const extra = await prisma.iml_customers.findFirst({
        where: { id: ensureId },
        select: { id: true, name: true, email: true, unit_type: true, parent_id: true },
      });
      if (extra) customers.unshift(extra);
    }
    return NextResponse.json({ customers });
  }

  if (type === "products") {
    if (customerId == null || Number.isNaN(customerId)) {
      return NextResponse.json({ products: [] });
    }
    const where: Prisma.iml_productsWhereInput = {
      customer_id: customerId,
      is_active: true,
    };
    if (q) {
      where.OR = [
        { ig_code: { contains: q } },
        { client_code: { contains: q } },
        { ig_short_name: { contains: q } },
        { client_name: { contains: q } },
        { ean_code: { contains: q } },
      ];
    }
    const products = await prisma.iml_products.findMany({
      where,
      orderBy: [{ ig_code: "asc" }, { client_code: "asc" }],
      take: 300,
      select: {
        id: true,
        ig_code: true,
        client_code: true,
        ig_short_name: true,
        client_name: true,
        ean_code: true,
        die_cut_id: true,
        label_shape_code: true,
      },
    });
    return NextResponse.json({ products });
  }

  if (type === "die_cuts") {
    if (customerId == null || Number.isNaN(customerId)) {
      return NextResponse.json({ die_cuts: [] });
    }
    const productDieCutIds = (
      await prisma.iml_products.findMany({
        where: { customer_id: customerId, die_cut_id: { not: null } },
        select: { die_cut_id: true },
        distinct: ["die_cut_id"],
      })
    )
      .map((r) => r.die_cut_id)
      .filter((id): id is number => id != null);

    const where: Prisma.iml_die_cutsWhereInput = {
      is_active: true,
      OR: [
        { customer_id: customerId },
        { customer_id: null },
        ...(productDieCutIds.length > 0 ? [{ id: { in: productDieCutIds } }] : []),
      ],
    };
    if (q) {
      where.AND = [
        {
          OR: [
            { label_shape_code: { contains: q } },
            { die_cut_tool_code: { contains: q } },
            { internal_name: { contains: q } },
            { assembly_code: { contains: q } },
          ],
        },
      ];
    }
    const die_cuts = await prisma.iml_die_cuts.findMany({
      where,
      orderBy: [{ label_shape_code: "asc" }],
      take: 300,
      select: {
        id: true,
        label_shape_code: true,
        die_cut_tool_code: true,
        internal_name: true,
        die_cut_format: true,
        customer_id: true,
      },
    });
    return NextResponse.json({ die_cuts });
  }

  return NextResponse.json({ error: "Neplatný type (customers|products|die_cuts)" }, { status: 400 });
}
