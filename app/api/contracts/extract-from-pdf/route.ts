import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { extractTextFromPdfBuffer } from "@/lib/contracts/extract-text-from-pdf";
import { extractContractDraftWithLlm } from "@/lib/contracts/llm-extract-contract-draft";

export const runtime = "nodejs";
export const maxDuration = 120;

const MAX_BYTES = 15 * 1024 * 1024;

/**
 * POST multipart/form-data: pole `file` = PDF.
 * Vrátí návrh polí pro formulář (nutná kontrola člověkem).
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }

  if (process.env.CONTRACT_EXTRACT_DISABLED === "1") {
    return NextResponse.json(
      { error: "Vytěžování z PDF je na tomto serveru vypnuté." },
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
    return NextResponse.json({ error: "Soubor je příliš velký (max. 15 MB)." }, { status: 400 });
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
    console.error("extract-from-pdf text:", e);
    return NextResponse.json(
      { error: "Soubor PDF se nepodařilo načíst. Zkuste jiný export nebo oprávnění." },
      { status: 400 }
    );
  }

  if (!text || text.length < 30) {
    return NextResponse.json(
      {
        error:
          "Z PDF se nepodařilo přečíst dost textu. Pravděpodobně jde o sken bez vrstvy textu – použijte OCR (nástroj mimo aplikaci) nebo PDF s textovou vrstvou.",
        code: "low_text",
      },
      { status: 422 }
    );
  }

  const types = await prisma.contract_types.findMany({
    where: { is_active: true },
    orderBy: [{ sort_order: "asc" }, { name: "asc" }],
    select: { id: true, name: true, code: true },
  });

  if (types.length === 0) {
    return NextResponse.json(
      { error: "V systému není žádný aktivní typ smlouvy. Doplňte ho v administraci." },
      { status: 400 }
    );
  }

  try {
    const extracted = await extractContractDraftWithLlm(text, types);
    return NextResponse.json({
      extracted,
      meta: {
        pageCount,
        textLength: text.length,
        provider: process.env.CONTRACT_EXTRACT_OPENAI_COMPAT_URL?.trim()
          ? "openai_compat"
          : "ollama",
      },
    });
  } catch (e) {
    console.error("extract-from-pdf llm:", e);
    const msg = e instanceof Error ? e.message : "Neznámá chyba";
    const hint =
      !process.env.CONTRACT_EXTRACT_OPENAI_COMPAT_URL?.trim()
        ? "Spusťte lokálně Ollama (https://ollama.com) a model např. `ollama pull llama3.2`, nebo nastavte CONTRACT_EXTRACT_OPENAI_COMPAT_URL."
        : "Zkontrolujte URL, klíč a model u poskytovatele API.";
    return NextResponse.json(
      {
        error: `Vytěžení přes AI selhalo: ${msg}`,
        hint,
      },
      { status: 503 }
    );
  }
}
