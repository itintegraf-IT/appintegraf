import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { canReadMaterialCatalog, canWriteMaterialCatalog } from "@/lib/materialy/access";
import { findCategoryByCode } from "@/lib/materialy/load-categories";
import { normalizeCategoryCode } from "@/lib/materialy/categories";

async function resolveCategory(param: string | null): Promise<string | null> {
  if (param == null || param.trim() === "") return null;
  const code = normalizeCategoryCode(param);
  const cat = await findCategoryByCode(code);
  return cat?.code ?? null;
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }

  const userId = parseInt(session.user.id, 10);
  if (!(await canReadMaterialCatalog(userId))) {
    return NextResponse.json({ error: "Nemáte oprávnění" }, { status: 403 });
  }

  const category = await resolveCategory(req.nextUrl.searchParams.get("category"));
  if (!category) {
    return NextResponse.json(
      { error: "Vyberte kategorii materiálu (parametr category: PAPER, FOIL, COLOR, LACQUER)." },
      { status: 400 }
    );
  }

  try {
    const subcategories = await prisma.material_subcategories.findMany({
      where: {
        category_code: category,
        is_active: true,
        parent_id: null,
      },
      orderBy: [{ sort_order: "asc" }, { name: "asc" }],
    });

    return NextResponse.json({ subcategories, category_code: category });
  } catch (e) {
    console.error("materialy/subcategories GET:", e);
    return NextResponse.json({ error: "Chyba při načítání podtypů" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }

  const userId = parseInt(session.user.id, 10);
  if (!(await canWriteMaterialCatalog(userId))) {
    return NextResponse.json({ error: "Nemáte oprávnění" }, { status: 403 });
  }

  try {
    const body = (await req.json()) as Record<string, unknown>;
    const name = String(body.name ?? "").trim();
    const category_code = await resolveCategory(
      body.category_code != null ? String(body.category_code) : null
    );

    if (!name) return NextResponse.json({ error: "Název je povinný" }, { status: 400 });
    if (!category_code) {
      return NextResponse.json(
        { error: "Neplatná nebo chybějící kategorie materiálu (PAPER, FOIL, COLOR, LACQUER)." },
        { status: 400 }
      );
    }

    const parent_id =
      body.parent_id != null && body.parent_id !== "" ? parseInt(String(body.parent_id), 10) : null;

    if (parent_id != null && Number.isFinite(parent_id)) {
      const parent = await prisma.material_subcategories.findUnique({
        where: { id: parent_id },
        select: { category_code: true },
      });
      if (!parent || parent.category_code !== category_code) {
        return NextResponse.json(
          { error: "Nadřazený podtyp nepatří do zvolené kategorie materiálu." },
          { status: 400 }
        );
      }
    }

    const duplicate = await prisma.material_subcategories.findFirst({
      where: {
        category_code,
        name,
        parent_id: Number.isFinite(parent_id) ? parent_id : null,
        is_active: true,
      },
    });
    if (duplicate) {
      const catRow = await findCategoryByCode(category_code);
      const catLabel = catRow?.label ?? category_code;
      return NextResponse.json(
        { error: `Podtyp „${name}" už v kategorii ${catLabel} existuje.` },
        { status: 400 }
      );
    }

    const row = await prisma.material_subcategories.create({
      data: {
        category_code,
        name,
        parent_id: Number.isFinite(parent_id) ? parent_id : null,
        sort_order: parseInt(String(body.sort_order ?? 0), 10) || 0,
        is_active: body.is_active !== false,
      },
    });

    return NextResponse.json({ subcategory: row });
  } catch (e) {
    console.error("materialy/subcategories POST:", e);
    return NextResponse.json({ error: "Chyba při ukládání podtypu" }, { status: 500 });
  }
}
