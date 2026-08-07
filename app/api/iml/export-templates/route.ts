import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { hasModuleAccess } from "@/lib/auth-utils";
import {
  sanitizeProductExportColumns,
  sanitizeProductExportFilters,
} from "@/lib/iml-export-product-columns";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }
  const userId = parseInt(session.user.id, 10);
  if (!(await hasModuleAccess(userId, "iml", "read"))) {
    return NextResponse.json({ error: "Nemáte oprávnění" }, { status: 403 });
  }

  const templates = await prisma.iml_export_templates.findMany({
    where: { user_id: userId, entity: "products" },
    orderBy: { updated_at: "desc" },
  });

  return NextResponse.json({ templates });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }
  const userId = parseInt(session.user.id, 10);
  if (!(await hasModuleAccess(userId, "iml", "write"))) {
    return NextResponse.json({ error: "Nemáte oprávnění k úpravám" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Neplatné tělo" }, { status: 400 });
  }

  const name = typeof body.name === "string" ? body.name.trim().slice(0, 150) : "";
  if (!name) {
    return NextResponse.json({ error: "Název šablony je povinný" }, { status: 400 });
  }

  const format = body.format === "xml" ? "xml" : "csv";
  const columns = sanitizeProductExportColumns(body.columns);
  const filters = sanitizeProductExportFilters(body.filters);

  const created = await prisma.iml_export_templates.create({
    data: {
      user_id: userId,
      name,
      entity: "products",
      format,
      columns,
      filters,
    },
  });

  return NextResponse.json({ success: true, template: created });
}
