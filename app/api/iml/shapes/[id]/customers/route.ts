import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { hasModuleAccess } from "@/lib/auth-utils";
import { canManageImlShapes } from "@/lib/iml-permissions";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }
  const userId = parseInt(session.user.id, 10);
  if (!(await hasModuleAccess(userId, "iml", "read"))) {
    return NextResponse.json({ error: "Nemáte oprávnění" }, { status: 403 });
  }

  const shapeId = parseInt((await ctx.params).id, 10);
  if (Number.isNaN(shapeId)) {
    return NextResponse.json({ error: "Neplatné ID" }, { status: 400 });
  }

  const shape = await prisma.iml_shape_catalog.findUnique({
    where: { id: shapeId },
    select: { id: true },
  });
  if (!shape) return NextResponse.json({ error: "Tvar nenalezen" }, { status: 404 });

  const rows = await prisma.iml_shape_customer_assignment.findMany({
    where: { shape_id: shapeId },
    include: {
      customer: { select: { id: true, name: true } },
    },
    orderBy: { id: "asc" },
  });

  return NextResponse.json({
    customers: rows.map((r) => ({
      id: r.customer.id,
      name: r.customer.name,
      assignment_id: r.id,
    })),
  });
}

/** Nahradí seznam zákazníků tvaru (multiselect). Body: { customer_ids: number[] } */
export async function PUT(req: NextRequest, ctx: Ctx) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }
  const userId = parseInt(session.user.id, 10);
  if (!(await canManageImlShapes(userId))) {
    return NextResponse.json({ error: "Nemáte oprávnění" }, { status: 403 });
  }

  const shapeId = parseInt((await ctx.params).id, 10);
  if (Number.isNaN(shapeId)) {
    return NextResponse.json({ error: "Neplatné ID" }, { status: 400 });
  }

  const shape = await prisma.iml_shape_catalog.findUnique({
    where: { id: shapeId },
    select: { id: true },
  });
  if (!shape) return NextResponse.json({ error: "Tvar nenalezen" }, { status: 404 });

  const body = (await req.json().catch(() => ({}))) as { customer_ids?: unknown };
  const customerIds = Array.isArray(body.customer_ids)
    ? [
        ...new Set(
          body.customer_ids
            .map((x) => Number(x))
            .filter((n) => Number.isFinite(n) && n > 0)
        ),
      ]
    : [];

  if (customerIds.length > 0) {
    const found = await prisma.iml_customers.findMany({
      where: { id: { in: customerIds } },
      select: { id: true },
    });
    if (found.length !== customerIds.length) {
      return NextResponse.json({ error: "Některý zákazník neexistuje." }, { status: 400 });
    }
  }

  await prisma.$transaction(async (tx) => {
    await tx.iml_shape_customer_assignment.deleteMany({ where: { shape_id: shapeId } });
    if (customerIds.length > 0) {
      await tx.iml_shape_customer_assignment.createMany({
        data: customerIds.map((customer_id) => ({ shape_id: shapeId, customer_id })),
      });
    }
  });

  const rows = await prisma.iml_shape_customer_assignment.findMany({
    where: { shape_id: shapeId },
    include: { customer: { select: { id: true, name: true } } },
    orderBy: { id: "asc" },
  });

  return NextResponse.json({
    success: true,
    customers: rows.map((r) => ({
      id: r.customer.id,
      name: r.customer.name,
      assignment_id: r.id,
    })),
  });
}
