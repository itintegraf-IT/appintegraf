import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { hasModuleAccess } from "@/lib/auth-utils";
import { loadProductsForExport, renderProductExport } from "@/lib/iml-export-products-run";

/**
 * Spustí export produktů podle šablony nebo ad-hoc sloupců/filtrů.
 * Body: { templateId } | { format, columns, filters }
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }
  const userId = parseInt(session.user.id, 10);
  if (!(await hasModuleAccess(userId, "iml", "read"))) {
    return NextResponse.json({ error: "Nemáte oprávnění" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Neplatné tělo" }, { status: 400 });
  }

  let format: "csv" | "xml" = body.format === "xml" ? "xml" : "csv";
  let columnsInput: unknown = body.columns;
  let filtersInput: unknown = body.filters;

  if (body.templateId != null) {
    const templateId = parseInt(String(body.templateId), 10);
    if (Number.isNaN(templateId)) {
      return NextResponse.json({ error: "Neplatné ID šablony" }, { status: 400 });
    }
    const template = await prisma.iml_export_templates.findFirst({
      where: { id: templateId, user_id: userId, entity: "products" },
    });
    if (!template) {
      return NextResponse.json({ error: "Šablona nenalezena" }, { status: 404 });
    }
    format = template.format === "xml" ? "xml" : "csv";
    columnsInput = template.columns;
    filtersInput = template.filters;
  }

  const { rows, columns } = await loadProductsForExport(filtersInput, columnsInput);
  const rendered = renderProductExport(format, rows, columns);

  const bom = format === "csv" ? "\uFEFF" : "";
  return new NextResponse(bom + rendered.body, {
    headers: {
      "Content-Type": rendered.contentType,
      "Content-Disposition": `attachment; filename="${rendered.filename}"`,
      "X-Export-Row-Count": String(rows.length),
    },
  });
}
