import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { hasModuleAccess } from "@/lib/auth-utils";

const ENTITIES = ["products", "orders"] as const;
const FIELD_TYPES = ["text", "number", "date", "boolean"] as const;

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }

  const userId = parseInt(session.user.id, 10);
  if (!(await hasModuleAccess(userId, "iml", "write"))) {
    return NextResponse.json({ error: "Nemáte oprávnění" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const entity = searchParams.get("entity");
  const all = searchParams.get("all") === "true";

  const where: { entity?: string; is_active?: boolean } = {};
  if (entity && ENTITIES.includes(entity as (typeof ENTITIES)[number])) {
    where.entity = entity;
  }
  if (!all) where.is_active = true;

  const fields = await prisma.iml_custom_fields.findMany({
    where,
    orderBy: [{ entity: "asc" }, { sort_order: "asc" }, { id: "asc" }],
  });

  return NextResponse.json({ fields });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }

  const userId = parseInt(session.user.id, 10);
  if (!(await hasModuleAccess(userId, "iml", "write"))) {
    return NextResponse.json({ error: "Nemáte oprávnění" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { entity, field_key, label, field_type = "text", sort_order = 0 } = body;

    if (!entity || !field_key || !label) {
      return NextResponse.json(
        { error: "Vyplňte entitu, klíč pole a popisek" },
        { status: 400 }
      );
    }

    if (!ENTITIES.includes(entity)) {
      return NextResponse.json({ error: "Neplatná entita (products, orders)" }, { status: 400 });
    }

    const key = String(field_key).trim().toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");
    if (!key) {
      return NextResponse.json({ error: "Klíč pole musí obsahovat alfanumerické znaky" }, { status: 400 });
    }

    const type = FIELD_TYPES.includes(field_type as (typeof FIELD_TYPES)[number]) ? field_type : "text";

    const existing = await prisma.iml_custom_fields.findFirst({
      where: { entity, field_key: key },
    });
    if (existing) {
      return NextResponse.json({ error: "Pole s tímto klíčem již existuje" }, { status: 400 });
    }

    const field = await prisma.iml_custom_fields.create({
      data: {
        entity,
        field_key: key,
        label: String(label).trim(),
        field_type: type,
        sort_order: parseInt(String(sort_order), 10) || 0,
      },
    });

    return NextResponse.json({ success: true, field });
  } catch (e) {
    console.error("IML custom fields POST error:", e);
    return NextResponse.json({ error: "Chyba při vytváření pole" }, { status: 500 });
  }
}
