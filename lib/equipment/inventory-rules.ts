/** Pravidla inventury — čisté funkce bez DB. */

export type InventoryScopeType = "all" | "room" | "category";

export function validateInventoryCreate(
  body: unknown
): { ok: true; scopeType: InventoryScopeType; scopeId: number | null; name: string } | { ok: false; error: string } {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false, error: "Vyberte rozsah inventury." };
  }
  const b = body as Record<string, unknown>;
  const scopeType = b.scope_type;
  if (scopeType !== "all" && scopeType !== "room" && scopeType !== "category") {
    return { ok: false, error: "Vyberte rozsah inventury (místnost, skupina nebo celá firma)." };
  }

  let scopeId: number | null = null;
  if (scopeType !== "all") {
    const raw = typeof b.scope_id === "number" ? String(b.scope_id) : typeof b.scope_id === "string" ? b.scope_id.trim() : "";
    if (!/^\d+$/.test(raw) || Number(raw) <= 0) {
      return { ok: false, error: scopeType === "room" ? "Vyberte místnost." : "Vyberte skupinu." };
    }
    scopeId = Number(raw);
  }

  const rawName = typeof b.name === "string" ? b.name.trim() : "";
  if (rawName.length > 200) return { ok: false, error: "Název inventury může mít nejvýše 200 znaků." };
  const name = rawName || `Inventura ${new Date().toLocaleDateString("cs-CZ")}`;

  return { ok: true, scopeType, scopeId, name };
}

export type InventorySummary = { total: number; found: number; unexpected: number; extra: number; missing: number };

export function summarizeInventoryLines(lines: { line_status: string }[]): InventorySummary {
  const summary: InventorySummary = { total: lines.length, found: 0, unexpected: 0, extra: 0, missing: 0 };
  for (const { line_status } of lines) {
    if (line_status === "found" || line_status === "unexpected" || line_status === "extra" || line_status === "missing") {
      summary[line_status]++;
    }
  }
  return summary;
}
