import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { hasModuleAccess } from "@/lib/auth-utils";
import { loadOrderLinesForExport, renderOrderLineExport } from "@/lib/iml-export-orders-run";

/**
 * Spustí line-level export objednávek podle šablony nebo ad-hoc sloupců/filtrů.
 * Body: { templateId } | { format, columns, filters }
 * filters.order_ids — export konkrétních objednávek
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
      where: { id: templateId, user_id: userId, entity: "orders" },
    });
    if (!template) {
      return NextResponse.json({ error: "Šablona nenalezena" }, { status: 404 });
    }
    format = template.format === "xml" ? "xml" : "csv";
    columnsInput = template.columns;
    // Šablona + volitelné přepsání order_ids z requestu (detail / výběr)
    const templateFilters =
      template.filters && typeof template.filters === "object" ? template.filters : {};
    const override =
      body.filters && typeof body.filters === "object"
        ? (body.filters as Record<string, unknown>)
        : {};
    filtersInput = {
      ...(templateFilters as object),
      ...(override.order_ids != null ? { order_ids: override.order_ids } : {}),
    };
  }

  const { rows, columns } = await loadOrderLinesForExport(filtersInput, columnsInput);
  const rendered = renderOrderLineExport(format, rows, columns);

  const bom = format === "csv" ? "\uFEFF" : "";
  return new NextResponse(bom + rendered.body, {
    headers: {
      "Content-Type": rendered.contentType,
      "Content-Disposition": `attachment; filename="${rendered.filename}"`,
      "X-Export-Row-Count": String(rows.length),
    },
  });
}
