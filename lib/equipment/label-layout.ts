/**
 * Mřížka štítků majetku a místností na A4 — čistá logika bez DB (importuje ji i klient).
 * Jeden formát pro položky i místnosti; tisk může začít na libovolné pozici načatého archu.
 */

export const A4_WIDTH_MM = 210;
export const A4_HEIGHT_MM = 297;

/** Rozměr jednotlivého štítku pro tisk mimo arch (stránka o velikosti štítku). */
export const LABEL_WIDTH_MM = 90;
export const LABEL_HEIGHT_MM = 50;

/** Laserová tiskárna nepotiskne okraj papíru — obsah štítku od něj drží odstup. */
export const PAPER_SAFE_MARGIN_MM = 4;
/** Vnitřní okraj obsahu od hrany štítku. */
export const LABEL_PADDING_MM = 2;

/** Tolerance kontroly A4 jen pro zaokrouhlení (3 × 70 mm = přesně 210 mm projde, 210,01 mm ne). */
const FIT_TOLERANCE_MM = 0.001;

export type EquipmentLabelGridSpec = {
  cols: number;
  rows: number;
  labelWidthMm: number;
  labelHeightMm: number;
  marginTopMm: number;
  marginLeftMm: number;
  colGapMm: number;
  rowGapMm: number;
};

export type EquipmentLabelTemplateKey = "a4_70x37_3x8" | "visitka_2x5" | "compact_3x7";

export const EQUIPMENT_LABEL_TEMPLATES: Record<
  EquipmentLabelTemplateKey,
  { label: string; spec: EquipmentLabelGridSpec }
> = {
  a4_70x37_3x8: {
    label: "Arch 70×37 mm (3×8)",
    spec: {
      cols: 3,
      rows: 8,
      labelWidthMm: 70,
      labelHeightMm: 37,
      marginTopMm: 0.5,
      marginLeftMm: 0,
      colGapMm: 0,
      rowGapMm: 0,
    },
  },
  visitka_2x5: {
    label: "Vizitka 90×50 mm (2×5)",
    spec: {
      cols: 2,
      rows: 5,
      labelWidthMm: 90,
      labelHeightMm: 50,
      marginTopMm: 8,
      marginLeftMm: 8,
      colGapMm: 3,
      rowGapMm: 3,
    },
  },
  compact_3x7: {
    label: "Kompaktní 60×35 mm (3×7)",
    spec: {
      cols: 3,
      rows: 7,
      labelWidthMm: 60,
      labelHeightMm: 35,
      marginTopMm: 8,
      marginLeftMm: 8,
      colGapMm: 3,
      rowGapMm: 3,
    },
  },
};

export const DEFAULT_EQUIPMENT_LABEL_TEMPLATE: EquipmentLabelTemplateKey = "a4_70x37_3x8";

export function mmToPt(mm: number): number {
  return (mm / 25.4) * 72;
}

export type LabelSlot = {
  x: number;
  y: number;
  widthMm: number;
  heightMm: number;
};

/** Obdélník v mm měřený od levého horního rohu stránky. */
export type MmBox = { xMm: number; yMm: number; wMm: number; hMm: number };

export function labelsPerPage(spec: EquipmentLabelGridSpec): number {
  return Math.max(1, spec.cols) * Math.max(1, spec.rows);
}

export function resolveEquipmentLabelTemplate(
  key: string | null | undefined
): EquipmentLabelTemplateKey {
  if (key && key in EQUIPMENT_LABEL_TEMPLATES) {
    return key as EquipmentLabelTemplateKey;
  }
  return DEFAULT_EQUIPMENT_LABEL_TEMPLATE;
}

export function getTemplateSpec(key: string | null | undefined): EquipmentLabelGridSpec {
  const k = resolveEquipmentLabelTemplate(key);
  return { ...EQUIPMENT_LABEL_TEMPLATES[k].spec };
}

/** Uložená nastavení z doby jednoho okraje nesou `pageMarginMm` — platí pro horní i levý. */
type LegacyGridSpec = Partial<EquipmentLabelGridSpec> & { pageMarginMm?: unknown };

export function normalizeEquipmentLabelGridSpec(
  partial: LegacyGridSpec | null | undefined,
  base?: EquipmentLabelGridSpec
): EquipmentLabelGridSpec {
  const b = base ?? getTemplateSpec(DEFAULT_EQUIPMENT_LABEL_TEMPLATE);
  const clamp = (n: unknown, fallback: number, min: number, max: number) => {
    const v = typeof n === "number" ? n : parseFloat(String(n));
    if (!Number.isFinite(v)) return fallback;
    return Math.min(max, Math.max(min, v));
  };
  const legacyMargin = partial?.pageMarginMm;
  return {
    cols: Math.round(clamp(partial?.cols, b.cols, 1, 6)),
    rows: Math.round(clamp(partial?.rows, b.rows, 1, 12)),
    labelWidthMm: clamp(partial?.labelWidthMm, b.labelWidthMm, 20, 200),
    labelHeightMm: clamp(partial?.labelHeightMm, b.labelHeightMm, 15, 140),
    marginTopMm: clamp(partial?.marginTopMm ?? legacyMargin, b.marginTopMm, 0, 40),
    marginLeftMm: clamp(partial?.marginLeftMm ?? legacyMargin, b.marginLeftMm, 0, 40),
    colGapMm: clamp(partial?.colGapMm, b.colGapMm, 0, 20),
    rowGapMm: clamp(partial?.rowGapMm, b.rowGapMm, 0, 20),
  };
}

function formatMm(value: number): string {
  return (Math.round(value * 100) / 100).toString().replace(".", ",");
}

/** `null` = mřížka se vejde na A4; jinak česká hláška, o kolik přetéká. */
export function labelGridFitError(spec: EquipmentLabelGridSpec): string | null {
  const width = spec.marginLeftMm + spec.cols * spec.labelWidthMm + (spec.cols - 1) * spec.colGapMm;
  const height = spec.marginTopMm + spec.rows * spec.labelHeightMm + (spec.rows - 1) * spec.rowGapMm;
  if (width > A4_WIDTH_MM + FIT_TOLERANCE_MM) {
    return `Mřížka se nevejde na A4: šířka ${formatMm(width)} mm je víc než ${A4_WIDTH_MM} mm.`;
  }
  if (height > A4_HEIGHT_MM + FIT_TOLERANCE_MM) {
    return `Mřížka se nevejde na A4: výška ${formatMm(height)} mm je víc než ${A4_HEIGHT_MM} mm.`;
  }
  return null;
}

/** Obdélník štítku na stránce (mm od levého horního rohu). */
export function labelBoxMm(spec: EquipmentLabelGridSpec, slotIndex: number): MmBox {
  const col = slotIndex % spec.cols;
  const row = Math.floor(slotIndex / spec.cols);
  return {
    xMm: spec.marginLeftMm + col * (spec.labelWidthMm + spec.colGapMm),
    yMm: spec.marginTopMm + row * (spec.labelHeightMm + spec.rowGapMm),
    wMm: spec.labelWidthMm,
    hMm: spec.labelHeightMm,
  };
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Plocha pro obsah štítku: štítek zmenšený o vnitřní okraj a zároveň ne blíž
 * k hraně papíru než `paperSafeMm` (tiskárna by krajní štítky ořízla).
 */
export function labelContentBox(
  spec: EquipmentLabelGridSpec,
  slotIndex: number,
  opts: { paperSafeMm: number; paddingMm: number } = { paperSafeMm: PAPER_SAFE_MARGIN_MM, paddingMm: LABEL_PADDING_MM }
): MmBox {
  const box = labelBoxMm(spec, slotIndex);
  const left = Math.max(box.xMm + opts.paddingMm, opts.paperSafeMm);
  const top = Math.max(box.yMm + opts.paddingMm, opts.paperSafeMm);
  const right = Math.min(box.xMm + box.wMm - opts.paddingMm, A4_WIDTH_MM - opts.paperSafeMm);
  const bottom = Math.min(box.yMm + box.hMm - opts.paddingMm, A4_HEIGHT_MM - opts.paperSafeMm);
  return {
    xMm: round2(left),
    yMm: round2(top),
    wMm: round2(Math.max(0, right - left)),
    hMm: round2(Math.max(0, bottom - top)),
  };
}

/** Pozice štítků na A4 (pt, počátek vlevo dole jako v pdf-lib). */
export function getLabelSlotsOnA4(spec?: EquipmentLabelGridSpec): LabelSlot[] {
  const s = spec ?? getTemplateSpec(DEFAULT_EQUIPMENT_LABEL_TEMPLATE);
  const slots: LabelSlot[] = [];
  for (let i = 0; i < labelsPerPage(s); i++) {
    const box = labelBoxMm(s, i);
    slots.push({
      x: mmToPt(box.xMm),
      y: mmToPt(A4_HEIGHT_MM - box.yMm - box.hMm),
      widthMm: s.labelWidthMm,
      heightMm: s.labelHeightMm,
    });
  }
  return slots;
}

/** Rozvržení štítků na archy; tisk začíná na pozici `startPosition` (1 = levý horní). */
export function planLabelSheets<T>(
  entries: T[],
  spec: EquipmentLabelGridSpec,
  startPosition: number
): { page: number; slot: number; entry: T }[] {
  const perPage = labelsPerPage(spec);
  if (!Number.isInteger(startPosition) || startPosition < 1 || startPosition > perPage) {
    throw new RangeError(`Pozice na archu musí být 1–${perPage}.`);
  }
  return entries.map((entry, i) => {
    const index = startPosition - 1 + i;
    return { page: Math.floor(index / perPage), slot: index % perPage, entry };
  });
}

/** Startovní pozice z formuláře nebo URL; prázdná = 1. */
export function validateStartPosition(
  raw: unknown,
  perPage: number
): { ok: true; value: number } | { ok: false; error: string } {
  if (raw === undefined || raw === null || raw === "") return { ok: true, value: 1 };
  const value = typeof raw === "number" ? raw : Number(String(raw).trim());
  if (!Number.isInteger(value) || value < 1 || value > perPage) {
    return { ok: false, error: `Pozice na archu musí být celé číslo 1–${perPage}.` };
  }
  return { ok: true, value };
}
