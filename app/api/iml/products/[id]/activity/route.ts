import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { hasModuleAccess } from "@/lib/auth-utils";
import type { Prisma } from "@prisma/client";

function parseJsonField(raw: string | null): unknown {
  if (raw == null || raw === "") return null;
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return raw;
  }
}

function userDisplayName(u: {
  first_name: string | null;
  last_name: string | null;
} | null): string | null {
  if (!u) return null;
  const name = [u.first_name, u.last_name].filter(Boolean).join(" ").trim();
  return name || null;
}

/**
 * Auditní stopa produktu: audit_log pro iml_products + iml_product_files daného produktu.
 * GET ?limit=&offset=
 */
export async function GET(
  req: NextRequest,
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

  const productId = parseInt((await params).id, 10);
  if (Number.isNaN(productId)) {
    return NextResponse.json({ error: "Neplatné ID" }, { status: 400 });
  }

  const product = await prisma.iml_products.findUnique({
    where: { id: productId },
    select: { id: true },
  });
  if (!product) {
    return NextResponse.json({ error: "Produkt nenalezen" }, { status: 404 });
  }

  const { searchParams } = new URL(req.url);
  const limitRaw = parseInt(searchParams.get("limit") ?? "50", 10);
  const offsetRaw = parseInt(searchParams.get("offset") ?? "0", 10);
  const limit = Math.min(200, Math.max(1, Number.isFinite(limitRaw) ? limitRaw : 50));
  const offset = Math.max(0, Number.isFinite(offsetRaw) ? offsetRaw : 0);

  const fileRows = await prisma.iml_product_files.findMany({
    where: { product_id: productId },
    select: { id: true },
  });
  const fileIds = fileRows.map((f) => f.id);

  const orFilters: Prisma.audit_logWhereInput[] = [
    { table_name: "iml_products", record_id: productId },
  ];
  if (fileIds.length > 0) {
    orFilters.push({
      table_name: "iml_product_files",
      record_id: { in: fileIds },
    });
  }

  const where: Prisma.audit_logWhereInput = {
    module: "iml",
    OR: orFilters,
  };

  const [total, logs] = await Promise.all([
    prisma.audit_log.count({ where }),
    prisma.audit_log.findMany({
      where,
      orderBy: { created_at: "desc" },
      skip: offset,
      take: limit,
      include: {
        users: { select: { first_name: true, last_name: true } },
      },
    }),
  ]);

  const items = logs.map((log) => ({
    id: log.id,
    action: log.action,
    table_name: log.table_name,
    record_id: log.record_id,
    created_at: log.created_at.toISOString(),
    userName: userDisplayName(log.users),
    old_values: parseJsonField(log.old_values),
    new_values: parseJsonField(log.new_values),
  }));

  return NextResponse.json({ items, total, limit, offset });
}
