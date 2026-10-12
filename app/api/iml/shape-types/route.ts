import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { hasModuleAccess } from "@/lib/auth-utils";
import { canManageImlShapes } from "@/lib/iml-permissions";
import type { Prisma } from "@prisma/client";

/** Kód typu: bez diakritiky, uppercase (vanička → VANICKA). */
function normalizeTypeCode(raw: string): string {
  return raw
    .trim()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toUpperCase()
    .replace(/[^A-Z0-9_-]/g, "")
    .slice(0, 20);
}

function parseBody(body: Record<string, unknown>) {
  const code = normalizeTypeCode(body.code != null ? String(body.code) : "");
  const name = body.name != null ? String(body.name).trim().slice(0, 100) : "";
  if (!code) {
    return {
      error: "Kód typu je povinný (písmena/číslice; diakritika se odstraní, např. vanička → VANICKA).",
      field: "code" as const,
    };
  }
  if (!name) return { error: "Název typu je povinný.", field: "name" as const };
  const is_active =
    body.is_active !== false && body.is_active !== "false" && body.is_active !== 0;
  const sort_order =
    body.sort_order != null && body.sort_order !== ""
      ? parseInt(String(body.sort_order), 10)
      : 100;
  return {
    code,
    name,
    is_active,
    sort_order: Number.isFinite(sort_order) ? sort_order : 100,
  };
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }
  const userId = parseInt(session.user.id, 10);
  if (!(await hasModuleAccess(userId, "iml", "read"))) {
    return NextResponse.json({ error: "Nemáte oprávnění" }, { status: 403 });
  }

  const includeInactive =
    new URL(req.url).searchParams.get("include_inactive") === "1";
  const where: Prisma.iml_shape_typesWhereInput = includeInactive
    ? {}
    : { is_active: true };

  const shape_types = await prisma.iml_shape_types.findMany({
    where,
    orderBy: [{ sort_order: "asc" }, { name: "asc" }],
    take: 500,
  });
  return NextResponse.json({ shape_types });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }
  const userId = parseInt(session.user.id, 10);
  if (!(await canManageImlShapes(userId))) {
    return NextResponse.json({ error: "Nemáte oprávnění spravovat typy tvarů" }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const parsed = parseBody(body);
  if ("error" in parsed) {
    return NextResponse.json({ error: parsed.error, field: parsed.field }, { status: 400 });
  }

  try {
    const created = await prisma.iml_shape_types.create({ data: parsed });
    return NextResponse.json({ success: true, shape_type: created });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("Unique") || msg.includes("Duplicate")) {
      return NextResponse.json(
        { error: `Kód typu „${parsed.code}“ už existuje.` },
        { status: 409 }
      );
    }
    console.error("POST /api/iml/shape-types", e);
    return NextResponse.json(
      { error: `Uložení selhalo: ${msg.slice(0, 200)}` },
      { status: 500 }
    );
  }
}
