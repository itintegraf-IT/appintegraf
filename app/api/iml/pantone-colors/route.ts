import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { hasModuleAccess } from "@/lib/auth-utils";
import { toImlPantoneShape } from "@/lib/materialy/iml-compat";
import { migrateLegacyImlTablesIfPresent } from "@/lib/iml/product-materials";

let legacyMigrated = false;

async function ensureLegacy() {
  if (!legacyMigrated) {
    await migrateLegacyImlTablesIfPresent();
    legacyMigrated = true;
  }
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }
  const userId = parseInt(session.user.id, 10);
  if (!(await hasModuleAccess(userId, "iml", "read"))) {
    return NextResponse.json({ error: "Nemáte oprávnění" }, { status: 403 });
  }

  await ensureLegacy();

  // Všechny barvy z katalogu (PANTONE je podskupina; starší klienti očekávají kompletní seznam barev)
  const rows = await prisma.materials.findMany({
    where: { category_code: "COLOR", is_active: true },
    orderBy: { name: "asc" },
  });

  return NextResponse.json({ pantone_colors: rows.map(toImlPantoneShape), colors: rows.map(toImlPantoneShape) });
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

  await ensureLegacy();

  const body = await req.json();
  const name = String(body.name ?? "").trim();
  if (!name) return NextResponse.json({ error: "Název je povinný" }, { status: 400 });

  let pantoneSub = await prisma.material_subcategories.findFirst({
    where: { category_code: "COLOR", name: "PANTONE", parent_id: null },
  });
  if (!pantoneSub) {
    pantoneSub = await prisma.material_subcategories.create({
      data: { category_code: "COLOR", name: "PANTONE", sort_order: 1 },
    });
  }

  const row = await prisma.materials.create({
    data: {
      category_code: "COLOR",
      subcategory_id: pantoneSub.id,
      name,
      code: body.code ? String(body.code).trim() : body.pantone_code ? String(body.pantone_code).trim() : null,
      description: body.description ? String(body.description).trim() : null,
      is_active: body.is_active !== false,
    },
  });

  return NextResponse.json({ pantone_color: toImlPantoneShape(row), color: toImlPantoneShape(row) });
}
