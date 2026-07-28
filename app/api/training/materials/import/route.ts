import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { hasModuleAccess } from "@/lib/auth-utils";
import {
  autoMapMaterialColumns,
  buildMaterialsFromCsv,
  groupMaterials,
  parseCsvRaw,
  type MaterialMapping,
} from "@/lib/training/csv-import";

const MAX_FILE_SIZE = 4 * 1024 * 1024; // 4 MB

function parseMapping(raw: string | null): MaterialMapping | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    const m = parsed as Record<string, unknown>;
    return {
      category: typeof m.category === "number" ? m.category : null,
      title: typeof m.title === "number" ? m.title : null,
      content: Array.isArray(m.content)
        ? m.content.filter((x): x is number => typeof x === "number")
        : [],
      source: typeof m.source === "number" ? m.source : null,
    };
  } catch {
    return null;
  }
}

/**
 * CSV import výukových materiálů s mapováním sloupců.
 * FormData:
 *   file     – CSV soubor
 *   mode     – "analyze" | "validate" | "import"
 *   mapping  – JSON { category, title, content: number[], source }
 *   group_by – "row" (každý řádek = materiál) | "category" (sloučit řádky okruhu)
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }

  const userId = parseInt(session.user.id, 10);
  if (!(await hasModuleAccess(userId, "training", "write"))) {
    return NextResponse.json({ error: "Nemáte oprávnění importovat materiály" }, { status: 403 });
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const mode = String(formData.get("mode") ?? "validate");
    const groupBy = formData.get("group_by") === "category" ? "category" : "row";
    const mappingRaw = parseMapping(formData.get("mapping") as string | null);

    if (!file?.size) {
      return NextResponse.json({ error: "Žádný soubor" }, { status: 400 });
    }
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: "Soubor je příliš velký (max 4 MB)" }, { status: 400 });
    }

    const text = await file.text();
    const raw = parseCsvRaw(text);
    if (!raw || raw.rows.length === 0) {
      return NextResponse.json({ error: "Soubor je prázdný nebo neobsahuje data" }, { status: 400 });
    }

    const mapping = mappingRaw ?? autoMapMaterialColumns(raw);
    const parsed = buildMaterialsFromCsv(raw, mapping);
    const materials = groupMaterials(parsed.rows, groupBy);

    if (mode === "analyze" || mode === "validate") {
      return NextResponse.json({
        success: true,
        mode,
        header: raw.header,
        delimiter: raw.delimiter,
        sampleRows: raw.rows.slice(0, 5).map((r) => ({ line: r.line, cells: r.cells })),
        mapping,
        totalRows: parsed.totalRows,
        validRows: parsed.rows.length,
        errors: parsed.errors.slice(0, 50),
        totalErrors: parsed.errors.length,
        resultCount: materials.length,
        preview: materials.slice(0, 10).map((m) => ({
          category: m.category,
          title: m.title,
          contentLength: m.content.length,
        })),
      });
    }

    if (materials.length === 0) {
      return NextResponse.json(
        { error: "Žádný validní řádek k importu – zkontrolujte mapování sloupců" },
        { status: 400 }
      );
    }

    // Kategorie podle názvu/kódu, chybějící se založí
    const categories = await prisma.question_categories.findMany();
    type CategoryRow = (typeof categories)[number];
    const categoryIdByKey = new Map<string, number>();
    for (const c of categories as CategoryRow[]) {
      categoryIdByKey.set(c.code.toLowerCase(), c.id);
      categoryIdByKey.set(c.name.toLowerCase(), c.id);
    }

    let imported = 0;
    const errors: { line: number; message: string }[] = [...parsed.errors];

    for (const material of materials) {
      let categoryId: number | null = null;
      if (material.category) {
        const key = material.category.toLowerCase();
        categoryId = categoryIdByKey.get(key) ?? null;
        if (categoryId === null) {
          try {
            const code = material.category
              .normalize("NFD")
              .replace(/[\u0300-\u036f]/g, "")
              .replace(/[^a-zA-Z0-9]+/g, "_")
              .toUpperCase()
              .slice(0, 50);
            const created = await prisma.question_categories.create({
              data: { name: material.category, code, is_active: true },
            });
            categoryId = created.id;
            categoryIdByKey.set(key, created.id);
            categoryIdByKey.set(code.toLowerCase(), created.id);
          } catch {
            categoryId = null;
          }
        }
      }

      try {
        await prisma.learning_materials.create({
          data: {
            title: material.title.slice(0, 255),
            content: material.content,
            category_id: categoryId,
            source: material.source,
          },
        });
        imported++;
      } catch (e) {
        console.error("Training material import error:", e);
        errors.push({ line: 0, message: `Chyba při ukládání materiálu „${material.title}“` });
      }
    }

    return NextResponse.json({
      success: true,
      imported,
      totalRows: parsed.totalRows,
      errors: errors.slice(0, 50),
      totalErrors: errors.length,
    });
  } catch (e) {
    console.error("Training materials import error:", e);
    return NextResponse.json({ error: "Chyba při importu materiálů" }, { status: 500 });
  }
}
