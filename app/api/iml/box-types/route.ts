import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { hasModuleAccess } from "@/lib/auth-utils";
import { logImlAudit } from "@/lib/iml-audit";
import type { Prisma } from "@prisma/client";

function parseBody(body: Record<string, unknown>) {
  const code = body.code != null ? String(body.code).trim().slice(0, 50) : "";
  const name = body.name != null ? String(body.name).trim().slice(0, 255) : "";
  if (!code) return { error: "Kód je povinný.", field: "code" as const };
  if (!name) return { error: "Název je povinný.", field: "name" as const };
  const description =
    body.description != null && String(body.description).trim()
      ? String(body.description).trim().slice(0, 5000)
      : null;
  const is_active =
    body.is_active !== false && body.is_active !== "false" && body.is_active !== 0;
  return { code, name, description, is_active };
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }
  const userId = parseInt(session.user.id, 10);
  if (!(await hasModuleAccess(userId, "iml", "read"))) {
    return NextResponse.json({ error: "Nemáte oprávnění k modulu IML" }, { status: 403 });
  }

  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  const includeInactive =
    url.searchParams.get("include_inactive") === "1" ||
    url.searchParams.get("include_inactive") === "true";

  const where: Prisma.iml_box_typesWhereInput = {
    ...(includeInactive ? {} : { is_active: true }),
    ...(q
      ? {
          OR: [
            { code: { contains: q } },
            { name: { contains: q } },
            { description: { contains: q } },
          ],
        }
      : {}),
  };

  const rows = await prisma.iml_box_types.findMany({
    where,
    orderBy: [{ is_active: "desc" }, { code: "asc" }],
    take: 500,
  });

  return NextResponse.json({ box_types: rows });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }
  const userId = parseInt(session.user.id, 10);
  if (!(await hasModuleAccess(userId, "iml", "write"))) {
    return NextResponse.json({ error: "Nemáte oprávnění k úpravám IML" }, { status: 403 });
  }

  try {
    const body = (await req.json()) as Record<string, unknown>;
    const parsed = parseBody(body);
    if ("error" in parsed) {
      return NextResponse.json({ error: parsed.error, field: parsed.field }, { status: 400 });
    }

    const existing = await prisma.iml_box_types.findUnique({ where: { code: parsed.code } });
    if (existing) {
      return NextResponse.json(
        { error: `Typ krabice s kódem „${parsed.code}“ už existuje.`, field: "code" },
        { status: 409 }
      );
    }

    const row = await prisma.iml_box_types.create({ data: parsed });
    await logImlAudit({
      userId,
      action: "create",
      tableName: "iml_box_types",
      recordId: row.id,
      newValues: row as unknown as Record<string, unknown>,
    });

    return NextResponse.json({ box_type: row }, { status: 201 });
  } catch (e) {
    console.error("POST /api/iml/box-types", e);
    return NextResponse.json({ error: "Chyba při vytváření typu krabice" }, { status: 500 });
  }
}
