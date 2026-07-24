import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { hasModuleAccess } from "@/lib/auth-utils";
import { logImlAudit } from "@/lib/iml-audit";

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

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }
  const userId = parseInt(session.user.id, 10);
  if (!(await hasModuleAccess(userId, "iml", "read"))) {
    return NextResponse.json({ error: "Nemáte oprávnění" }, { status: 403 });
  }

  const id = parseInt((await params).id, 10);
  if (Number.isNaN(id)) return NextResponse.json({ error: "Neplatné ID" }, { status: 400 });

  const row = await prisma.iml_box_types.findUnique({ where: { id } });
  if (!row) return NextResponse.json({ error: "Typ krabice nenalezen" }, { status: 404 });
  return NextResponse.json({ box_type: row });
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }
  const userId = parseInt(session.user.id, 10);
  if (!(await hasModuleAccess(userId, "iml", "write"))) {
    return NextResponse.json({ error: "Nemáte oprávnění" }, { status: 403 });
  }

  const id = parseInt((await params).id, 10);
  if (Number.isNaN(id)) return NextResponse.json({ error: "Neplatné ID" }, { status: 400 });

  const existing = await prisma.iml_box_types.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Typ krabice nenalezen" }, { status: 404 });

  try {
    const body = (await req.json()) as Record<string, unknown>;
    const parsed = parseBody(body);
    if ("error" in parsed) {
      return NextResponse.json({ error: parsed.error, field: parsed.field }, { status: 400 });
    }

    if (parsed.code !== existing.code) {
      const clash = await prisma.iml_box_types.findUnique({ where: { code: parsed.code } });
      if (clash) {
        return NextResponse.json(
          { error: `Typ krabice s kódem „${parsed.code}“ už existuje.`, field: "code" },
          { status: 409 }
        );
      }
    }

    const row = await prisma.iml_box_types.update({ where: { id }, data: parsed });
    await logImlAudit({
      userId,
      action: "update",
      tableName: "iml_box_types",
      recordId: id,
      oldValues: existing as unknown as Record<string, unknown>,
      newValues: row as unknown as Record<string, unknown>,
    });

    return NextResponse.json({ box_type: row });
  } catch (e) {
    console.error("PUT /api/iml/box-types/[id]", e);
    return NextResponse.json({ error: "Chyba při ukládání typu krabice" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }
  const userId = parseInt(session.user.id, 10);
  if (!(await hasModuleAccess(userId, "iml", "write"))) {
    return NextResponse.json({ error: "Nemáte oprávnění" }, { status: 403 });
  }

  const id = parseInt((await params).id, 10);
  if (Number.isNaN(id)) return NextResponse.json({ error: "Neplatné ID" }, { status: 400 });

  const existing = await prisma.iml_box_types.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Typ krabice nenalezen" }, { status: 404 });

  const row = await prisma.iml_box_types.update({
    where: { id },
    data: { is_active: false },
  });

  await logImlAudit({
    userId,
    action: "delete",
    tableName: "iml_box_types",
    recordId: id,
    oldValues: existing as unknown as Record<string, unknown>,
    newValues: row as unknown as Record<string, unknown>,
  });

  return NextResponse.json({ box_type: row });
}
