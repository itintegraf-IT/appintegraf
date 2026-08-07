/** Rozměry mřížky štítků na A4 (mm) — dle Excel šablon Standard / neut / Oriflame */

export type LabelGridSpec = {
  cols: number;
  rows: number;
  labelWidthMm: number;
  labelHeightMm: number;
  pageMarginMm: number;
  colGapMm: number;
  rowGapMm: number;
};

/** Volitelné přepsání rozměrů mřížky podle componentKey (standard / neut / oriflame). */
export type LabelGridOverridesMap = Record<string, Partial<LabelGridSpec>>;

export const LABEL_GRID_SPECS: Record<string, LabelGridSpec> = {
  standard: {
    cols: 2,
    rows: 7,
    labelWidthMm: 95,
    labelHeightMm: 38,
    pageMarginMm: 10,
    colGapMm: 4,
    rowGapMm: 1,
  },
  neut: {
    cols: 2,
    rows: 7,
    labelWidthMm: 95,
    labelHeightMm: 38,
    pageMarginMm: 10,
    colGapMm: 4,
    rowGapMm: 1,
  },
  oriflame: {
    cols: 2,
    rows: 5,
    labelWidthMm: 95,
    labelHeightMm: 48,
    pageMarginMm: 10,
    colGapMm: 4,
    rowGapMm: 2,
  },
};

export function getGridSpec(
  componentKey: string,
  overrides?: LabelGridOverridesMap | null
): LabelGridSpec {
  const key = componentKey === "pending" ? "standard" : componentKey;
  const base = LABEL_GRID_SPECS[key] ?? LABEL_GRID_SPECS.standard;
  const over = overrides?.[key];
  if (!over) return base;
  return { ...base, ...over };
}

/** Pozice levého horního rohu štítku na stránce (mm od levého a horního okraje). */
export function labelPositionMm(
  indexOnPage: number,
  spec: LabelGridSpec
): { x: number; y: number } {
  const col = indexOnPage % spec.cols;
  const row = Math.floor(indexOnPage / spec.cols);
  return {
    x: spec.pageMarginMm + col * (spec.labelWidthMm + spec.colGapMm),
    y: spec.pageMarginMm + row * (spec.labelHeightMm + spec.rowGapMm),
  };
}

export const A4_WIDTH_MM = 210;
export const A4_HEIGHT_MM = 297;
