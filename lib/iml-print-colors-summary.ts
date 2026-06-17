export type ProductCmykFlags = {
  c: boolean;
  m: boolean;
  y: boolean;
  k: boolean;
};

export const defaultProductCmykFlags = (): ProductCmykFlags => ({
  c: true,
  m: true,
  y: true,
  k: true,
});

export const CMYK_ALL_OFF: ProductCmykFlags = { c: false, m: false, y: false, k: false };

/** Platný řádek Pantone = kód + pokrytí 0–100 (stejná pravidla jako při ukládání). */
export function isValidPantoneRow(row: {
  code: string;
  coverage_pct: string;
}): boolean {
  const code = row.code.trim();
  if (!code) return false;
  const coverage = parseFloat(row.coverage_pct);
  return Number.isFinite(coverage) && coverage >= 0 && coverage <= 100;
}

export function hasValidPantoneRows(
  colors: Array<{ code: string; coverage_pct: string }>
): boolean {
  return colors.some(isValidPantoneRow);
}

export function buildPrintColorsSummary(
  cmyk: ProductCmykFlags,
  pantones: Array<{ code: string; coverage_pct?: number | string | null }>
): string {
  const parts: string[] = [];

  const pantoneParts: string[] = [];
  for (const row of pantones) {
    const code = row.code.trim();
    if (!code) continue;
    const covRaw = row.coverage_pct;
    const cov =
      covRaw != null && covRaw !== "" && Number.isFinite(Number(covRaw))
        ? ` ${Number(covRaw)}%`
        : "";
    pantoneParts.push(`${code}${cov}`);
  }

  if (pantoneParts.length === 0) {
    const channels: string[] = [];
    if (cmyk.c) channels.push("C");
    if (cmyk.m) channels.push("M");
    if (cmyk.y) channels.push("Y");
    if (cmyk.k) channels.push("K");
    if (channels.length === 4) parts.push("CMYK");
    else if (channels.length > 0) parts.push(channels.join(""));
  }

  parts.push(...pantoneParts);
  return parts.join(" + ");
}

export function cmykFlagsFromProduct(row: {
  cmyk_c_enabled?: boolean | null;
  cmyk_m_enabled?: boolean | null;
  cmyk_y_enabled?: boolean | null;
  cmyk_k_enabled?: boolean | null;
}): ProductCmykFlags {
  return {
    c: row.cmyk_c_enabled !== false,
    m: row.cmyk_m_enabled !== false,
    y: row.cmyk_y_enabled !== false,
    k: row.cmyk_k_enabled !== false,
  };
}

export function cmykFlagsToDb(cmyk: ProductCmykFlags) {
  return {
    cmyk_c_enabled: cmyk.c,
    cmyk_m_enabled: cmyk.m,
    cmyk_y_enabled: cmyk.y,
    cmyk_k_enabled: cmyk.k,
  };
}
