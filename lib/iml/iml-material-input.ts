/** Pomocné parsování vstupů pro IML číselníky materiálů (fólie, barvy). */

export function parseHexColor(v: unknown): string | null {
  if (v == null || v === "") return null;
  const s = String(v).trim();
  const withHash = s.startsWith("#") ? s : `#${s}`;
  if (!/^#[0-9A-Fa-f]{6}$/.test(withHash)) return null;
  return withHash.toUpperCase();
}

export function parseCmykComponent(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  return Math.min(100, Math.max(0, Math.round(n)));
}

export type ParsedCmyk = { c: number; m: number; y: number; k: number };

export function parseFullCmyk(body: Record<string, unknown>): ParsedCmyk | null {
  const c = parseCmykComponent(body.cmyk_c ?? body.c);
  const m = parseCmykComponent(body.cmyk_m ?? body.m);
  const y = parseCmykComponent(body.cmyk_y ?? body.y);
  const k = parseCmykComponent(body.cmyk_k ?? body.k);
  if (c == null || m == null || y == null || k == null) return null;
  return { c, m, y, k };
}
