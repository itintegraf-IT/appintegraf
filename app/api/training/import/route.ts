import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { hasModuleAccess } from "@/lib/auth-utils";
import {
  autoMapQuestionColumns,
  buildQuestionsFromCsv,
  parseCsvRaw,
  type QuestionMapping,
} from "@/lib/training/csv-import";

const MAX_FILE_SIZE = 4 * 1024 * 1024; // 4 MB

async function requireWrite(): Promise<{ userId: number } | NextResponse> {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }
  const userId = parseInt(session.user.id, 10);
  if (!(await hasModuleAccess(userId, "training", "write"))) {
    return NextResponse.json({ error: "Nemáte oprávnění importovat otázky" }, { status: 403 });
  }
  return { userId };
}

/** Historie importů */
export async function GET() {
  const access = await requireWrite();
  if (access instanceof NextResponse) return access;

  const imports = await prisma.question_imports.findMany({
    include: { users: { select: { first_name: true, last_name: true } } },
    orderBy: { created_at: "desc" },
    take: 50,
  });

  return NextResponse.json({ imports });
}

function parseMapping(raw: string | null): QuestionMapping | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? (parsed as QuestionMapping) : null;
  } catch {
    return null;
  }
}

/**
 * CSV import otázek s mapováním sloupců.
 * FormData:
 *   file    – CSV soubor
 *   mode    – "analyze" (rozbor + návrh mapování), "validate" (kontrola s mapováním),
 *             "import" (zápis do DB)
 *   mapping – JSON { pole: indexSloupce } (pro validate/import; u analyze se použije auto-návrh)
 */
export async function POST(req: NextRequest) {
  const access = await requireWrite();
  if (access instanceof NextResponse) return access;
  const { userId } = access;

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const mode = String(formData.get("mode") ?? "validate");
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

    const mapping = mappingRaw ?? autoMapQuestionColumns(raw);
    const parsed = buildQuestionsFromCsv(raw, mapping);

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
        preview: parsed.rows.slice(0, 10).map((r) => ({
          line: r.line,
          category: r.category,
          question: r.question,
          correct_answers: r.correct_answers,
        })),
      });
    }

    if (parsed.rows.length === 0) {
      return NextResponse.json(
        { error: "Žádný validní řádek k importu – zkontrolujte mapování sloupců" },
        { status: 400 }
      );
    }

    // Kategorie: dohledání podle kódu i názvu, chybějící se založí automaticky
    const categories = await prisma.question_categories.findMany();
    type CategoryRow = (typeof categories)[number];
    const categoryIdByKey = new Map<string, number>();
    for (const c of categories as CategoryRow[]) {
      categoryIdByKey.set(c.code.toLowerCase(), c.id);
      categoryIdByKey.set(c.name.toLowerCase(), c.id);
    }

    const errors = [...parsed.errors];
    let successCount = 0;

    for (const row of parsed.rows) {
      const key = row.category.toLowerCase();
      let categoryId = categoryIdByKey.get(key);

      if (!categoryId) {
        try {
          const code = row.category
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/[^a-zA-Z0-9]+/g, "_")
            .toUpperCase()
            .slice(0, 50);
          const created = await prisma.question_categories.create({
            data: { name: row.category, code, is_active: true },
          });
          categoryId = created.id;
          categoryIdByKey.set(key, created.id);
          categoryIdByKey.set(code.toLowerCase(), created.id);
        } catch {
          errors.push({ line: row.line, message: `Nepodařilo se založit kategorii „${row.category}“` });
          continue;
        }
      }

      try {
        await prisma.questions.create({
          data: {
            category_id: categoryId,
            question: row.question,
            option_a: row.option_a,
            option_b: row.option_b,
            option_c: row.option_c,
            option_d: row.option_d,
            correct_answer: row.correct_answer,
            correct_answers: row.correct_answers,
            difficulty: row.difficulty ?? undefined,
            explanation: row.explanation,
            source: row.source,
            is_active: true,
          },
        });
        successCount++;
      } catch (e) {
        console.error("Training import row error:", e);
        errors.push({ line: row.line, message: "Chyba při ukládání otázky do databáze" });
      }
    }

    await prisma.question_imports.create({
      data: {
        filename: file.name.slice(0, 255),
        imported_by: userId,
        records_count: parsed.totalRows,
        success_count: successCount,
        error_count: errors.length,
        errors: errors.length ? JSON.stringify(errors.slice(0, 100)) : null,
      },
    });

    return NextResponse.json({
      success: true,
      imported: successCount,
      totalRows: parsed.totalRows,
      errors: errors.slice(0, 50),
      totalErrors: errors.length,
    });
  } catch (e) {
    console.error("Training import error:", e);
    return NextResponse.json({ error: "Chyba při importu" }, { status: 500 });
  }
}
