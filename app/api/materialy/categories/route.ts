import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { canReadMaterialCatalog, canWriteMaterialCatalog } from "@/lib/materialy/access";
import {
  normalizeCategoryCode,
  slugifyCategoryLabel,
} from "@/lib/materialy/categories";
import {
  getMaterialCategories,
  invalidateMaterialCategoriesCache,
} from "@/lib/materialy/load-categories";
import { ensureMaterialCategoriesSchema } from "@/lib/materialy/ensure-material-categories-schema";
import { logMaterialyAuditSafe } from "@/lib/materialy/audit";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }

  const userId = parseInt(session.user.id, 10);
  if (!(await canReadMaterialCatalog(userId))) {
    return NextResponse.json({ error: "Nemáte oprávnění" }, { status: 403 });
  }

  try {
    const categories = await getMaterialCategories();
    return NextResponse.json({ categories });
  } catch (e) {
    console.error("materialy/categories GET:", e);
    return NextResponse.json({ error: "Chyba při načítání skupin" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }

  const userId = parseInt(session.user.id, 10);
  if (!(await canWriteMaterialCatalog(userId))) {
    return NextResponse.json({ error: "Nemáte oprávnění k úpravám katalogu" }, { status: 403 });
  }

  try {
    await ensureMaterialCategoriesSchema();
    const body = (await req.json()) as Record<string, unknown>;
    const label = String(body.label ?? "").trim();
    if (!label) {
      return NextResponse.json({ error: "Název skupiny je povinný" }, { status: 400 });
    }

    const code = normalizeCategoryCode(String(body.code ?? ""), label);
    if (!code) {
      return NextResponse.json({ error: "Kód skupiny je neplatný" }, { status: 400 });
    }

    let slug = String(body.slug ?? "").trim().toLowerCase();
    if (!slug) slug = slugifyCategoryLabel(label);
    slug = slug.replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);
    if (!slug) {
      return NextResponse.json({ error: "URL slug skupiny je neplatný" }, { status: 400 });
    }

    const existingCode = await prisma.material_categories.findUnique({ where: { code } });
    if (existingCode) {
      return NextResponse.json({ error: `Skupina s kódem „${code}" už existuje.` }, { status: 400 });
    }

    const existingSlug = await prisma.material_categories.findFirst({ where: { slug } });
    if (existingSlug) {
      return NextResponse.json({ error: `Slug „${slug}" už používá jiná skupina.` }, { status: 400 });
    }

    const maxOrder = await prisma.material_categories.aggregate({ _max: { sort_order: true } });
    const sort_order =
      body.sort_order != null ? parseInt(String(body.sort_order), 10) : (maxOrder._max.sort_order ?? 0) + 1;

    const row = await prisma.material_categories.create({
      data: {
        code,
        label,
        slug,
        sort_order: Number.isFinite(sort_order) ? sort_order : 0,
      },
    });

    invalidateMaterialCategoriesCache();

    await logMaterialyAuditSafe({
      userId,
      action: "create",
      tableName: "material_categories",
      recordId: undefined,
      newValues: { code, label, slug },
    });

    return NextResponse.json({
      category: { code: row.code, label: row.label, slug: row.slug ?? slug, sort_order: row.sort_order },
    });
  } catch (e) {
    console.error("materialy/categories POST:", e);
    return NextResponse.json({ error: "Chyba při vytváření skupiny" }, { status: 500 });
  }
}
