import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { canReadMaterialCatalog, canWriteMaterialCatalog } from "@/lib/materialy/access";
import { resolveCategoryCode } from "@/lib/materialy/load-categories";
import { materialsTextSearchWhere } from "@/lib/materialy/text-search";
import { assertSubcategoryAllowed } from "@/lib/materialy/subcategory-guard";
import { parseMaterialOptionalDate } from "@/lib/materialy/dates";
import { materialyCreateErrorMessage } from "@/lib/materialy/prisma-errors";
import { logMaterialyAuditSafe } from "@/lib/materialy/audit";
import { ensureMaterialsTableColumns } from "@/lib/materialy/ensure-materials-schema";
import { loadMaterialFileSummaries } from "@/lib/materialy/material-files";

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

  const resolvedCategory =
    category != null && category !== "" ? await resolveCategoryCode(category) : null;
  const hasCategory = resolvedCategory != null;
  const textSearch = materialsTextSearchWhere(q);

  if (!hasCategory && !q) {
    return NextResponse.json({ materials: [] });
  }

  try {
    const materials = await prisma.materials.findMany({
      where: {
        ...(hasCategory ? { category_code: resolvedCategory! } : {}),
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

    const fileMap = await loadMaterialFileSummaries(materials.map((m) => m.id));
    const enriched = materials.map((m) => {
      const files = fileMap.get(m.id);
      return {
        ...m,
        sds_file: files?.sds ?? null,
        certificate_file: files?.certificate ?? null,
      };
    });

    return NextResponse.json({ materials: enriched });
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
    if (!(await resolveCategoryCode(category_code))) {
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
        issued_at: parseMaterialOptionalDate(body.issued_at),
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
