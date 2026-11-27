export type TechnologieProductInput = {
  name: string;
  format_text: string | null;
  note: string | null;
  sort_order: number;
};

/**
 * Parsuje products[] z body. Vyžaduje alespoň jeden neprázdný název.
 * Podporuje i legacy body s name/format_text/note na kořeni (jeden produkt).
 */
export function parseTechnologieProducts(
  body: Record<string, unknown>
): { ok: true; products: TechnologieProductInput[] } | { ok: false; error: string } {
  const raw = body.products;
  if (Array.isArray(raw)) {
    const products: TechnologieProductInput[] = [];
    for (let i = 0; i < raw.length; i++) {
      const row = raw[i];
      if (!row || typeof row !== "object") continue;
      const r = row as Record<string, unknown>;
      const name = typeof r.name === "string" ? r.name.trim() : "";
      if (!name) continue;
      const format_text =
        typeof r.format_text === "string" ? r.format_text.trim().slice(0, 64) || null : null;
      const note = typeof r.note === "string" ? r.note.trim() || null : null;
      products.push({
        name: name.slice(0, 255),
        format_text,
        note,
        sort_order: products.length,
      });
    }
    if (products.length === 0) {
      return { ok: false, error: "Přidejte alespoň jeden produkt s názvem." };
    }
    return { ok: true, products };
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) {
    return { ok: false, error: "Vyplňte název produktu." };
  }
  const format_text =
    typeof body.format_text === "string" ? body.format_text.trim().slice(0, 64) || null : null;
  const note = typeof body.note === "string" ? body.note.trim() || null : null;
  return {
    ok: true,
    products: [{ name: name.slice(0, 255), format_text, note, sort_order: 0 }],
  };
}

export const technologieProductsInclude = {
  orderBy: [{ sort_order: "asc" as const }, { id: "asc" as const }],
  select: {
    id: true,
    name: true,
    format_text: true,
    note: true,
    sort_order: true,
  },
};

/** Primární název / formát / poznámka z prvního produktu (pro kompatibilitu UI). */
export function primaryProductFields(
  products: Array<{ name: string; format_text: string | null; note: string | null }>
): { name: string; format_text: string | null; note: string | null } {
  const first = products[0];
  return {
    name: first?.name ?? "",
    format_text: first?.format_text ?? null,
    note: first?.note ?? null,
  };
}
