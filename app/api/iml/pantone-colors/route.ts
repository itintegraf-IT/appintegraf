import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { hasModuleAccess } from "@/lib/auth-utils";
import { logImlAudit } from "@/lib/iml-audit";
import { isValidPantoneCode, normalizePantoneCode } from "@/lib/iml-pantone";
import { toImlPantoneShape } from "@/lib/materialy/iml-compat";
import { migrateLegacyImlTablesIfPresent } from "@/lib/iml/product-materials";
import { assertSubcategoryAllowed } from "@/lib/materialy/subcategory-guard";
import { parseFullCmyk, parseHexColor } from "@/lib/iml/iml-material-input";
import { ensureCmykSubcategoryId, ensurePantoneSubcategoryId, getColorSubcategoryIds } from "@/lib/iml/iml-color-subcategories";
import type { Prisma } from "@prisma/client";

let legacyMigrated = false;

async function ensureLegacy() {
  if (!legacyMigrated) {
    await migrateLegacyImlTablesIfPresent();
    legacyMigrated = true;
  }
}

const colorInclude = {
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
  const legacySearch = url.searchParams.get("search")?.trim() ?? "";
  const legacyAll = url.searchParams.get("all") === "true";
  const q = (url.searchParams.get("q") ?? legacySearch).trim();
  const includeInactive =
    url.searchParams.get("include_inactive") === "1" ||
    url.searchParams.get("include_inactive") === "true" ||
    legacyAll;
  const kind = (url.searchParams.get("kind") ?? "").toLowerCase();

  const { pantoneId, cmykId } = await getColorSubcategoryIds();

  const where: Prisma.materialsWhereInput = {
    category_code: "COLOR",
    ...(includeInactive ? {} : { is_active: true }),
    ...(q
      ? {
          OR: [
            { name: { contains: q } },
            { code: { contains: q } },
            { description: { contains: q } },
          ],
        }
      : {}),
  };

  if (kind === "cmyk") {
    if (cmykId != null) {
      where.subcategory_id = cmykId;
    } else {
      where.id = { equals: -1 };
    }
  } else if (kind === "pantone") {
    if (cmykId != null) {
      where.NOT = { subcategory_id: cmykId };
    }
  }

  const rows = await prisma.materials.findMany({
    where,
    orderBy: [{ is_active: "desc" }, { name: "asc" }],
    take: 1000,
    include: colorInclude,
  });

  const mapped = rows.map(toImlPantoneShape);
  return NextResponse.json({
    pantone_colors: mapped,
    colors: mapped,
    _meta: { pantone_subcategory_id: pantoneId, cmyk_subcategory_id: cmykId },
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

  try {
    const body = await req.json();
    const name = String(body.name ?? "").trim();
    const codeRaw = body.code ?? body.pantone_code;
    const code = codeRaw != null && String(codeRaw).trim() !== "" ? String(codeRaw).trim() : null;
    if (!name) return NextResponse.json({ error: "Název je povinný" }, { status: 400 });
    if (!code) return NextResponse.json({ error: "Kód je povinný" }, { status: 400 });

    const colorKind = String(body.color_kind ?? "pantone").toLowerCase() === "cmyk" ? "cmyk" : "pantone";

    if (colorKind === "pantone") {
      const codeNorm = normalizePantoneCode(code);
      if (!isValidPantoneCode(codeNorm)) {
        return NextResponse.json(
          { error: "Neplatný Pantone kód (A–Z, 0–9, mezera, pomlčka; max 32 znaků)", field: "code" },
          { status: 400 }
        );
      }
    }

    let subcategory_id: number | null = null;
    if (body.subcategory_id != null && body.subcategory_id !== "") {
      const parsed = parseInt(String(body.subcategory_id), 10);
      subcategory_id = Number.isFinite(parsed) ? parsed : null;
    } else if (colorKind === "cmyk") {
      subcategory_id = await ensureCmykSubcategoryId();
    } else {
      subcategory_id = await ensurePantoneSubcategoryId();
    }

    const guard = await assertSubcategoryAllowed("COLOR", subcategory_id);
    if (!guard.ok) {
      return NextResponse.json({ error: guard.error }, { status: guard.status });
    }

    let hex_color: string | null = null;
    let cmyk_c: number | null = null;
    let cmyk_m: number | null = null;
    let cmyk_y: number | null = null;
    let cmyk_k: number | null = null;

    if (colorKind === "cmyk") {
      const cmyk = parseFullCmyk(body as Record<string, unknown>);
      if (!cmyk) {
        return NextResponse.json({ error: "Vyplňte všechny složky CMYK (0–100)." }, { status: 400 });
      }
      cmyk_c = cmyk.c;
      cmyk_m = cmyk.m;
      cmyk_y = cmyk.y;
      cmyk_k = cmyk.k;
    } else {
      hex_color = parseHexColor(body.hex_color ?? body.hex);
      if (body.hex_color != null && String(body.hex_color).trim() !== "" && !hex_color) {
        return NextResponse.json({ error: "Neplatný formát HEX (např. #FF0000)." }, { status: 400 });
      }
    }

    const codeForDb = colorKind === "pantone" ? normalizePantoneCode(code) : code;

    const row = await prisma.materials.create({
      data: {
        category_code: "COLOR",
        subcategory_id,
        name,
        code: codeForDb,
        description: body.description ? String(body.description).trim() : null,
        hex_color,
        cmyk_c,
        cmyk_m,
        cmyk_y,
        cmyk_k,
        is_active: body.is_active !== false,
      },
      include: colorInclude,
    });

    const pantone_color = toImlPantoneShape(row);

    await logImlAudit({
      userId,
      action: "create",
      tableName: "materials",
      recordId: row.id,
      newValues: { category_code: "COLOR", code: row.code, is_active: row.is_active },
    });

    return NextResponse.json({ success: true, pantone_color, color: pantone_color });
  } catch (e) {
    console.error("IML pantone-colors POST error:", e);
    return NextResponse.json({ error: "Chyba při vytváření barvy" }, { status: 500 });
  }
}
