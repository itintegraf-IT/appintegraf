import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { canReadMaterialCatalog, canWriteMaterialCatalog } from "@/lib/materialy/access";
import { isMaterialCategoryCode } from "@/lib/materialy/categories";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }

  const userId = parseInt(session.user.id, 10);
  if (!(await canReadMaterialCatalog(userId))) {
    return NextResponse.json({ error: "Nemáte oprávnění" }, { status: 403 });
  }

  const category = req.nextUrl.searchParams.get("category");
  try {
    const hasCategory = category != null && category !== "" && isMaterialCategoryCode(category);
    const subcategories = await prisma.material_subcategories.findMany({
      where: {
        ...(hasCategory ? { category_code: category } : {}),
        is_active: true,
        ...(hasCategory ? { parent_id: null } : {}),
      },
      orderBy: [{ sort_order: "asc" }, { name: "asc" }],
    });

    return NextResponse.json({ subcategories });
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
    const category_code = String(body.category_code ?? "").trim();
    if (!name) return NextResponse.json({ error: "Název je povinný" }, { status: 400 });
    if (!isMaterialCategoryCode(category_code)) {
      return NextResponse.json({ error: "Neplatná kategorie" }, { status: 400 });
    }

    const parent_id =
      body.parent_id != null && body.parent_id !== "" ? parseInt(String(body.parent_id), 10) : null;

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
