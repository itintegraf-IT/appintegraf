import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { hasModuleAccess } from "@/lib/auth-utils";
import { toImlFoilShape } from "@/lib/materialy/iml-compat";
import { migrateLegacyImlTablesIfPresent } from "@/lib/iml/product-materials";
import { assertSubcategoryAllowed } from "@/lib/materialy/subcategory-guard";
import type { Prisma } from "@prisma/client";

let legacyMigrated = false;

async function ensureLegacy() {
  if (!legacyMigrated) {
    await migrateLegacyImlTablesIfPresent();
    legacyMigrated = true;
  }
}

const foilInclude = {
  material_subcategories: { select: { name: true } },
} as const;

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }
  const userId = parseInt(session.user.id, 10);
  if (!(await hasModuleAccess(userId, "iml", "read"))) {
    return NextResponse.json({ error: "Nemáte oprávnění" }, { status: 403 });
  }

  await ensureLegacy();

  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  const includeInactive =
    url.searchParams.get("include_inactive") === "1" ||
    url.searchParams.get("include_inactive") === "true";

  const where: Prisma.materialsWhereInput = {
    category_code: "FOIL",
    ...(includeInactive ? {} : { is_active: true }),
    ...(q
      ? {
          OR: [
            { name: { contains: q } },
            { code: { contains: q } },
            { notes: { contains: q } },
            { description: { contains: q } },
          ],
        }
      : {}),
  };

  const rows = await prisma.materials.findMany({
    where,
    orderBy: [{ name: "asc" }],
    include: foilInclude,
  });

  return NextResponse.json({
    foils: rows.map(toImlFoilShape),
  });
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
  const code = String(body.code ?? "").trim();
  const name = String(body.name ?? "").trim();
  if (!code) return NextResponse.json({ error: "Kód je povinný" }, { status: 400 });
  if (!name) return NextResponse.json({ error: "Název je povinný" }, { status: 400 });

  const subcategory_id =
    body.subcategory_id != null && body.subcategory_id !== ""
      ? parseInt(String(body.subcategory_id), 10)
      : null;

  const guard = await assertSubcategoryAllowed("FOIL", Number.isFinite(subcategory_id) ? subcategory_id : null);
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }

  const thickness_label =
    body.thickness_label != null && String(body.thickness_label).trim() !== ""
      ? String(body.thickness_label).trim().slice(0, 80)
      : null;
  const notes =
    body.notes != null && String(body.notes).trim() !== "" ? String(body.notes).trim() : null;

  const row = await prisma.materials.create({
    data: {
      category_code: "FOIL",
      subcategory_id: Number.isFinite(subcategory_id) ? subcategory_id : null,
      name,
      code,
      thickness_label,
      notes,
      description: body.description != null && String(body.description).trim() !== "" ? String(body.description).trim() : null,
      is_active: body.is_active !== false,
    },
    include: foilInclude,
  });

  return NextResponse.json({ foil: toImlFoilShape(row) });
}
