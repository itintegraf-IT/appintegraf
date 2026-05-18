import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { canReadMaterialCatalog, canWriteMaterialCatalog } from "@/lib/materialy/access";
import { isMaterialCategoryCode } from "@/lib/materialy/categories";
import { materialsTextSearchWhere } from "@/lib/materialy/text-search";
import { assertSubcategoryAllowed } from "@/lib/materialy/subcategory-guard";
import { parseMaterialOptionalDate } from "@/lib/materialy/dates";
import { materialyCreateErrorMessage } from "@/lib/materialy/prisma-errors";
import { logMaterialyAuditSafe } from "@/lib/materialy/audit";
import { ensureMaterialsTableColumns } from "@/lib/materialy/ensure-materials-schema";

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
  const subcategoryId = parseInt(req.nextUrl.searchParams.get("subcategoryId") ?? "", 10);
  const activeOnly = req.nextUrl.searchParams.get("active") !== "false";
  const q = (req.nextUrl.searchParams.get("q") ?? "").trim();

  const hasCategory = category != null && category !== "" && isMaterialCategoryCode(category);
  const textSearch = materialsTextSearchWhere(q);

  if (!hasCategory && !q) {
    return NextResponse.json({ materials: [] });
  }

  try {
    const materials = await prisma.materials.findMany({
      where: {
        ...(hasCategory ? { category_code: category } : {}),
        ...(hasCategory && Number.isFinite(subcategoryId) ? { subcategory_id: subcategoryId } : {}),
        ...(activeOnly ? { is_active: true } : {}),
        ...(textSearch ? textSearch : {}),
      },
      orderBy: [{ category_code: "asc" }, { name: "asc" }],
      take: !hasCategory && q.length > 0 ? 100 : 500,
      include: {
        material_subcategories: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json({ materials });
  } catch (e) {
    console.error("materialy GET:", e);
    return NextResponse.json({ error: "Chyba při načítání katalogu" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }

  const userId = parseInt(session.user.id, 10);
  if (!(await canWriteMaterialCatalog(userId))) {
    return NextResponse.json({ error: "Nemáte oprávnění k úpravám" }, { status: 403 });
  }

  try {
    await ensureMaterialsTableColumns();
    const body = await req.json();
    const name = String(body.name ?? "").trim();
    const category_code = String(body.category_code ?? "").trim();
    if (!name) return NextResponse.json({ error: "Název je povinný" }, { status: 400 });
    if (!isMaterialCategoryCode(category_code)) {
      return NextResponse.json({ error: "Neplatná kategorie" }, { status: 400 });
    }

    const subcategory_id =
      body.subcategory_id != null && body.subcategory_id !== ""
        ? parseInt(String(body.subcategory_id), 10)
        : null;

    const subCheck = await assertSubcategoryAllowed(
      category_code,
      Number.isFinite(subcategory_id) ? subcategory_id : null
    );
    if (!subCheck.ok) {
      return NextResponse.json({ error: subCheck.error }, { status: subCheck.status });
    }

    const row = await prisma.materials.create({
      data: {
        category_code,
        subcategory_id: Number.isFinite(subcategory_id) ? subcategory_id : null,
        name,
        code: body.code ? String(body.code).trim() : null,
        manufacturer: body.manufacturer ? String(body.manufacturer).trim() : null,
        supplier: body.supplier ? String(body.supplier).trim() : null,
        description: body.description ? String(body.description).trim() : null,
        cas_number: body.cas_number ? String(body.cas_number).trim() : null,
        notes: body.notes ? String(body.notes).trim() : null,
        is_active: body.is_active !== false,
        valid_until: parseMaterialOptionalDate(body.valid_until),
        certificate_valid_until: parseMaterialOptionalDate(body.certificate_valid_until),
      },
    });

    await logMaterialyAuditSafe({
      userId,
      action: "create",
      tableName: "materials",
      recordId: row.id,
      newValues: { name: row.name, category_code: row.category_code },
    });

    return NextResponse.json({ material: row });
  } catch (e) {
    console.error("materialy POST:", e);
    return NextResponse.json({ error: materialyCreateErrorMessage(e) }, { status: 500 });
  }
}
