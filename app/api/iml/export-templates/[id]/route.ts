import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { hasModuleAccess } from "@/lib/auth-utils";
import {
  sanitizeProductExportColumns,
  sanitizeProductExportFilters,
} from "@/lib/iml-export-product-columns";
import {
  sanitizeOrderExportColumns,
  sanitizeOrderExportFilters,
} from "@/lib/iml-export-order-columns";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }
  const userId = parseInt(session.user.id, 10);
  if (!(await hasModuleAccess(userId, "iml", "write"))) {
    return NextResponse.json({ error: "Nemáte oprávnění" }, { status: 403 });
  }

  const id = parseInt((await params).id, 10);
  if (isNaN(id)) {
    return NextResponse.json({ error: "Neplatné ID" }, { status: 400 });
  }

  const existing = await prisma.iml_export_templates.findFirst({
    where: { id, user_id: userId },
  });
  if (!existing) {
    return NextResponse.json({ error: "Šablona nenalezena" }, { status: 404 });
  }

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Neplatné tělo" }, { status: 400 });
  }

  const entity = existing.entity === "orders" ? "orders" : "products";
  const data: Prisma.iml_export_templatesUpdateInput = {};

  if (typeof body.name === "string") {
    const name = body.name.trim().slice(0, 150);
    if (!name) {
      return NextResponse.json({ error: "Název nesmí být prázdný" }, { status: 400 });
    }
    data.name = name;
  }
  if (body.format === "csv" || body.format === "xml") data.format = body.format;
  if (body.columns !== undefined) {
    data.columns =
      entity === "orders"
        ? sanitizeOrderExportColumns(body.columns)
        : sanitizeProductExportColumns(body.columns);
  }
  if (body.filters !== undefined) {
    const filters =
      entity === "orders"
        ? sanitizeOrderExportFilters(body.filters)
        : sanitizeProductExportFilters(body.filters);
    data.filters = Object.keys(filters).length > 0 ? filters : Prisma.JsonNull;
  }

  const updated = await prisma.iml_export_templates.update({
    where: { id },
    data,
  });

  return NextResponse.json({ success: true, template: updated });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }
  const userId = parseInt(session.user.id, 10);
  if (!(await hasModuleAccess(userId, "iml", "write"))) {
    return NextResponse.json({ error: "Nemáte oprávnění" }, { status: 403 });
  }

  const id = parseInt((await params).id, 10);
  if (isNaN(id)) {
    return NextResponse.json({ error: "Neplatné ID" }, { status: 400 });
  }

  const existing = await prisma.iml_export_templates.findFirst({
    where: { id, user_id: userId },
  });
  if (!existing) {
    return NextResponse.json({ error: "Šablona nenalezena" }, { status: 404 });
  }

  await prisma.iml_export_templates.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
