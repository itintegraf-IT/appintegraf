import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { canReadMaterialCatalog } from "@/lib/materialy/access";
import { isMaterialCategoryCode } from "@/lib/materialy/categories";
import { materialsTextSearchWhere } from "@/lib/materialy/text-search";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }

  const userId = parseInt(session.user.id, 10);
  if (!(await canReadMaterialCatalog(userId))) {
    return NextResponse.json({ error: "Nemáte oprávnění" }, { status: 403 });
  }

  const category = req.nextUrl.searchParams.get("category") ?? "";
  if (!isMaterialCategoryCode(category)) {
    return NextResponse.json({ error: "Neplatná kategorie" }, { status: 400 });
  }

  const q = (req.nextUrl.searchParams.get("q") ?? "").trim();
  const subcategoryId = parseInt(req.nextUrl.searchParams.get("subcategoryId") ?? "", 10);

  try {
    const items = await prisma.materials.findMany({
      where: {
        category_code: category,
        is_active: true,
        ...(Number.isFinite(subcategoryId) ? { subcategory_id: subcategoryId } : {}),
        ...(materialsTextSearchWhere(q) ?? {}),
      },
      orderBy: [{ name: "asc" }],
      take: 200,
      select: {
        id: true,
        name: true,
        code: true,
        subcategory_id: true,
        material_subcategories: { select: { name: true } },
      },
    });

    return NextResponse.json({
      options: items.map((m) => ({
        id: m.id,
        name: m.name,
        code: m.code,
        label: m.code ? `${m.name} (${m.code})` : m.name,
        subcategoryName: m.material_subcategories?.name ?? null,
      })),
    });
  } catch (e) {
    console.error("materialy/options GET:", e);
    return NextResponse.json({ error: "Chyba při načítání možností" }, { status: 500 });
  }
}
