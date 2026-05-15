import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { hasModuleAccess } from "@/lib/auth-utils";
import { prisma } from "@/lib/db";
import { extractTextFromPdfBuffer } from "@/lib/contracts/extract-text-from-pdf";
import { extractCvDraftWithLlm } from "@/lib/personalistika/llm-extract-cv-draft";
import {
  draftToFieldItems,
  truncateSourceTextForUi,
} from "@/lib/personalistika/cv-field-registry";
import { ensurePersonalistikaTables } from "@/lib/personalistika-db";

export const runtime = "nodejs";
export const maxDuration = 300;

const MAX_BYTES = 20 * 1024 * 1024;

/**
 * POST multipart/form-data: pole `file` = PDF životopisu.
 * Vrátí návrh polí pro dotazník (nutná kontrola člověkem před uložením).
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }
  const userId = parseInt(session.user.id, 10);
  if (!(await hasModuleAccess(userId, "personalistika", "write"))) {
    return NextResponse.json({ error: "Nemáte oprávnění k zápisu v modulu Personalistika." }, { status: 403 });
  }

  if (process.env.PERSONALISTIKA_CV_EXTRACT_DISABLED === "1") {
    return NextResponse.json(
      { error: "Vytěžování CV z PDF je na tomto serveru vypnuté." },
      { status: 503 }
    );
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Neplatný formulář." }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof Blob) || file.size === 0) {
    return NextResponse.json({ error: "Nahrajte soubor PDF." }, { status: 400 });
  }

  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "Soubor je příliš velký (max. 20 MB)." }, { status: 400 });
  }

  const mime = (file as File).type ?? "";
  if (mime && !mime.includes("pdf") && !mime.includes("octet-stream")) {
    return NextResponse.json({ error: "Očekává se soubor PDF." }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  let text: string;
  let pageCount: number;
  try {
    const r = await extractTextFromPdfBuffer(buffer);
    text = r.text;
    pageCount = r.pageCount;
  } catch (e) {
    console.error("personalistika extract-from-cv text:", e);
    return NextResponse.json(
      { error: "Soubor PDF se nepodařilo načíst. Zkuste jiný export." },
      { status: 400 }
    );
  }

  if (!text || text.length < 30) {
    return NextResponse.json(
      {
        error:
          "Z PDF se nepodařilo přečíst dost textu. Pravděpodobně jde o sken – použijte PDF s textovou vrstvou.",
        code: "low_text",
      },
      { status: 422 }
    );
  }

  await ensurePersonalistikaTables();

  const positions = (await prisma.$queryRawUnsafe(
    `SELECT id, name FROM hr_positions WHERE is_active = 1 ORDER BY name ASC`
  )) as { id: number; name: string }[];

  try {
    const { draft: extracted, modelUsed, provider, usedFallback, primaryError } =
      await extractCvDraftWithLlm(text, positions);
    const { sourceText, sourceTextTruncated } = truncateSourceTextForUi(text);
    const fields = draftToFieldItems(extracted);
    return NextResponse.json({
      extracted,
      fields,
      sourceText,
      sourceTextTruncated,
      meta: {
        pageCount,
        textLength: text.length,
        provider,
        model: modelUsed,
        usedFallback,
        primaryError: usedFallback ? primaryError : undefined,
      },
    });
  } catch (e) {
    console.error("personalistika extract-from-cv llm:", e);
    const msg = e instanceof Error ? e.message : "Neznámá chyba";
    return NextResponse.json(
      {
        error: `Vytěžení CV přes AI selhalo: ${msg}`,
        hint: "Nastavte Groq (PERSONALISTIKA_CV_EXTRACT_OPENAI_COMPAT_*) a zálohu Gemini (PERSONALISTIKA_CV_EXTRACT_FALLBACK_OPENAI_COMPAT_KEY z aistudio.google.com).",
      },
      { status: 503 }
    );
  }
}
