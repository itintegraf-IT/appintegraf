import type { ReplaceResult } from "@/lib/iml-product-colors";

const CMYK_MIGRATION_HINT =
  "Chybí sloupce CMYK v databázi (cmyk_c_enabled …). Na serveru spusťte: npm run db:iml-cmyk-flags nebo npx prisma migrate deploy.";

function messageMentionsCmykColumns(msg: string): boolean {
  const lower = msg.toLowerCase();
  return lower.includes("cmyk_c_enabled") || lower.includes("cmyk_m_enabled");
}

/** Čitelná chyba z Prisma / transakce při ukládání produktu. */
export function imlProductSaveErrorResponse(
  e: unknown,
  defaultMessage = "Chyba při ukládání produktu"
): { status: number; error: string } {
  if (e && typeof e === "object" && "code" in e) {
    const code = String((e as { code: string }).code);
    const metaMsg = (e as { meta?: { message?: string } }).meta?.message ?? "";
    if (
      typeof metaMsg === "string" &&
      (metaMsg.includes("Unknown column") || messageMentionsCmykColumns(metaMsg))
    ) {
      if (messageMentionsCmykColumns(metaMsg)) {
        return { status: 503, error: CMYK_MIGRATION_HINT };
      }
    }
    if (code === "P2002") {
      return { status: 400, error: "Duplicitní hodnota (např. SKU)." };
    }
    if (
      code === "P2003" &&
      typeof metaMsg === "string" &&
      metaMsg.toLowerCase().includes("pantone_id")
    ) {
      return {
        status: 422,
        error:
          "Barva odkazuje na neexistující Pantone kartu. Znovu vyberte kód z číselníku nebo vytvořte novou kartu.",
      };
    }
  }

  if (e instanceof Error) {
    const msg = e.message;
    if (messageMentionsCmykColumns(msg) || msg.includes("Unknown column")) {
      return { status: 503, error: CMYK_MIGRATION_HINT };
    }
    if (msg.includes("Foreign key constraint") && msg.toLowerCase().includes("pantone_id")) {
      return {
        status: 422,
        error:
          "Barva odkazuje na neexistující Pantone kartu. Znovu vyberte kód z číselníku nebo vytvořte novou kartu.",
      };
    }
    if (msg.length > 0 && msg.length <= 300) {
      return { status: 500, error: msg };
    }
    if (msg.length > 300) {
      return { status: 500, error: `${msg.slice(0, 300)}…` };
    }
  }

  return { status: 500, error: defaultMessage };
}

export function imlProductColorsReplaceErrorResponse(
  res: Extract<ReplaceResult, { ok: false }>
): { status: number; body: Record<string, unknown> } {
  return {
    status: res.status,
    body: {
      error: res.error,
      ...(res.missing_codes ? { missing_codes: res.missing_codes } : {}),
      ...(res.details ? { details: res.details } : {}),
    },
  };
}
