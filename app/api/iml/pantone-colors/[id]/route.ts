import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { hasModuleAccess } from "@/lib/auth-utils";
import { logImlAudit } from "@/lib/iml-audit";
import { isValidPantoneCode, normalizePantoneCode } from "@/lib/iml-pantone";
import { findMaterialForImlLegacyId, toImlPantoneShape } from "@/lib/materialy/iml-compat";
import { assertSubcategoryAllowed } from "@/lib/materialy/subcategory-guard";
import { parseFullCmyk, parseHexColor } from "@/lib/iml/iml-material-input";
import { ensureCmykSubcategoryId, ensurePantoneSubcategoryId } from "@/lib/iml/iml-color-subcategories";

const colorInclude = {
  material_subcategories: { select: { name: true } },
} as const;

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }
  const userId = parseInt(session.user.id, 10);
  if (!(await hasModuleAccess(userId, "iml", "read"))) {
    return NextResponse.json({ error: "Nemáte oprávnění" }, { status: 403 });
  }

  const id = parseInt((await params).id, 10);
  if (Number.isNaN(id)) return NextResponse.json({ error: "Neplatné ID" }, { status: 400 });

  const row = await findMaterialForImlLegacyId("COLOR", "iml_pantone_colors", id);
  if (!row) return NextResponse.json({ error: "Barva nenalezena" }, { status: 404 });

  const legacyPantoneId = row.legacy_source === "iml_pantone_colors" && row.legacy_id ? row.legacy_id : null;

  const [full, productColorLinks] = await Promise.all([
    prisma.materials.findUnique({
      where: { id: row.id },
      include: colorInclude,
    }),
    legacyPantoneId != null
      ? prisma.iml_product_colors.count({ where: { pantone_id: legacyPantoneId } })
      : Promise.resolve(0),
  ]);

  if (!full) return NextResponse.json({ error: "Barva nenalezena" }, { status: 404 });

  const pantone_color = toImlPantoneShape(full);
  return NextResponse.json({
    ...pantone_color,
    _count: { iml_product_colors: productColorLinks },
    pantone_color,
    color: pantone_color,
  });
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }
  const userId = parseInt(session.user.id, 10);
  if (!(await hasModuleAccess(userId, "iml", "write"))) {
    return NextResponse.json({ error: "Nemáte oprávnění" }, { status: 403 });
  }

  const id = parseInt((await params).id, 10);
  if (Number.isNaN(id)) return NextResponse.json({ error: "Neplatné ID" }, { status: 400 });

  const existing = await findMaterialForImlLegacyId("COLOR", "iml_pantone_colors", id);
  if (!existing) return NextResponse.json({ error: "Barva nenalezena" }, { status: 404 });

  try {
    const body = await req.json();

    let subcategory_id = existing.subcategory_id;
    if (body.subcategory_id !== undefined) {
      if (body.subcategory_id === null || body.subcategory_id === "") {
        subcategory_id = null;
      } else {
        const parsed = parseInt(String(body.subcategory_id), 10);
        subcategory_id = Number.isFinite(parsed) ? parsed : null;
      }
    }

    let hex_color = existing.hex_color;
    let cmyk_c = existing.cmyk_c;
    let cmyk_m = existing.cmyk_m;
    let cmyk_y = existing.cmyk_y;
    let cmyk_k = existing.cmyk_k;

    if (body.color_kind !== undefined) {
      const colorKind = String(body.color_kind).toLowerCase() === "cmyk" ? "cmyk" : "pantone";
      if (colorKind === "cmyk") {
        const parsedCmyk = parseFullCmyk(body as Record<string, unknown>);
        if (!parsedCmyk) {
          return NextResponse.json({ error: "Vyplňte všechny složky CMYK (0–100)." }, { status: 400 });
        }
        cmyk_c = parsedCmyk.c;
        cmyk_m = parsedCmyk.m;
        cmyk_y = parsedCmyk.y;
        cmyk_k = parsedCmyk.k;
        hex_color = null;
        if (body.subcategory_id !== undefined && body.subcategory_id !== null && body.subcategory_id !== "") {
          const sid = parseInt(String(body.subcategory_id), 10);
          subcategory_id = Number.isFinite(sid) ? sid : await ensureCmykSubcategoryId();
        } else {
          subcategory_id = await ensureCmykSubcategoryId();
        }
      } else {
        if (body.subcategory_id !== undefined && body.subcategory_id !== null && body.subcategory_id !== "") {
          const sid = parseInt(String(body.subcategory_id), 10);
          subcategory_id = Number.isFinite(sid) ? sid : await ensurePantoneSubcategoryId();
        } else {
          subcategory_id = await ensurePantoneSubcategoryId();
        }
        cmyk_c = null;
        cmyk_m = null;
        cmyk_y = null;
        cmyk_k = null;
        if (body.hex_color !== undefined || body.hex !== undefined) {
          const raw = body.hex_color !== undefined ? body.hex_color : body.hex;
          if (raw == null || String(raw).trim() === "") {
            hex_color = null;
          } else {
            const h = parseHexColor(raw);
            if (!h) {
              return NextResponse.json({ error: "Neplatný formát HEX (např. #FF0000)." }, { status: 400 });
            }
            hex_color = h;
          }
        }
      }
    } else {
      if (body.hex_color !== undefined || body.hex !== undefined) {
        const raw = body.hex_color !== undefined ? body.hex_color : body.hex;
        if (raw == null || String(raw).trim() === "") {
          hex_color = null;
        } else {
          const h = parseHexColor(raw);
          if (!h) {
            return NextResponse.json({ error: "Neplatný formát HEX (např. #FF0000)." }, { status: 400 });
          }
          hex_color = h;
        }
      }
      if (
        body.cmyk_c !== undefined ||
        body.cmyk_m !== undefined ||
        body.cmyk_y !== undefined ||
        body.cmyk_k !== undefined
      ) {
        const merged = {
          cmyk_c: body.cmyk_c !== undefined ? body.cmyk_c : existing.cmyk_c,
          cmyk_m: body.cmyk_m !== undefined ? body.cmyk_m : existing.cmyk_m,
          cmyk_y: body.cmyk_y !== undefined ? body.cmyk_y : existing.cmyk_y,
          cmyk_k: body.cmyk_k !== undefined ? body.cmyk_k : existing.cmyk_k,
        };
        const parsed = parseFullCmyk(merged as Record<string, unknown>);
        if (!parsed) {
          return NextResponse.json({ error: "CMYK musí být všechny složky 0–100." }, { status: 400 });
        }
        cmyk_c = parsed.c;
        cmyk_m = parsed.m;
        cmyk_y = parsed.y;
        cmyk_k = parsed.k;
      }
    }

    const guard = await assertSubcategoryAllowed("COLOR", subcategory_id);
    if (!guard.ok) {
      return NextResponse.json({ error: guard.error }, { status: guard.status });
    }

    let nextCode =
      body.code !== undefined
        ? body.code != null && String(body.code).trim() !== ""
          ? String(body.code).trim()
          : null
        : body.pantone_code !== undefined
          ? body.pantone_code != null && String(body.pantone_code).trim() !== ""
            ? String(body.pantone_code).trim()
            : null
          : existing.code;

    const subName = existing.material_subcategories?.name ?? null;
    const isPantoneRow = subName !== "CMYK" && !(cmyk_c != null && cmyk_m != null && cmyk_y != null && cmyk_k != null);
    if (isPantoneRow && nextCode) {
      const codeNorm = normalizePantoneCode(nextCode);
      if (!isValidPantoneCode(codeNorm)) {
        return NextResponse.json({ error: "Neplatný Pantone kód", field: "code" }, { status: 400 });
      }
      nextCode = codeNorm;
    }

    const row = await prisma.materials.update({
      where: { id: existing.id },
      data: {
        name: body.name != null ? String(body.name).trim() : existing.name,
        code: nextCode ?? existing.code,
        description:
          body.description !== undefined
            ? body.description != null && String(body.description).trim() !== ""
              ? String(body.description).trim()
              : null
            : existing.description,
        subcategory_id,
        hex_color,
        cmyk_c,
        cmyk_m,
        cmyk_y,
        cmyk_k,
        is_active: body.is_active !== undefined ? !!body.is_active : existing.is_active,
      },
      include: colorInclude,
    });

    const pantone_color = toImlPantoneShape(row);

    await logImlAudit({
      userId,
      action: "update",
      tableName: "materials",
      recordId: existing.id,
      oldValues: { code: existing.code, is_active: existing.is_active },
      newValues: { code: row.code, is_active: row.is_active },
    });

    return NextResponse.json({ success: true, pantone_color, color: pantone_color });
  } catch (e) {
    console.error("IML pantone-colors PUT error:", e);
    return NextResponse.json({ error: "Chyba při ukládání" }, { status: 500 });
  }
}

/**
 * Soft-delete: is_active=false.
 * Pokud je barva navázaná na produktové řádky nebo color_material_id, vrací 409.
 */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }
  const userId = parseInt(session.user.id, 10);
  if (!(await hasModuleAccess(userId, "iml", "write"))) {
    return NextResponse.json({ error: "Nemáte oprávnění" }, { status: 403 });
  }

  const id = parseInt((await params).id, 10);
  if (Number.isNaN(id)) return NextResponse.json({ error: "Neplatné ID" }, { status: 400 });

  const existing = await findMaterialForImlLegacyId("COLOR", "iml_pantone_colors", id);
  if (!existing) return NextResponse.json({ error: "Barva nenalezena" }, { status: 404 });

  const legacyPantoneId = existing.legacy_source === "iml_pantone_colors" && existing.legacy_id ? existing.legacy_id : null;

  const [productColorLinks, productFk] = await Promise.all([
    legacyPantoneId != null
      ? prisma.iml_product_colors.count({ where: { pantone_id: legacyPantoneId } })
      : Promise.resolve(0),
    prisma.iml_products.count({ where: { color_material_id: existing.id } }),
  ]);

  if (productColorLinks + productFk > 0) {
    return NextResponse.json(
      {
        error: `Barva je navázána na ${productColorLinks + productFk} produkt(ů) / řádků. Odstraňte nejprve vazby nebo ji deaktivujte.`,
      },
      { status: 409 }
    );
  }

  await prisma.materials.update({ where: { id: existing.id }, data: { is_active: false } });

  await logImlAudit({
    userId,
    action: "delete",
    tableName: "materials",
    recordId: existing.id,
    oldValues: { code: existing.code, is_active: existing.is_active },
  });

  return NextResponse.json({ success: true });
}
