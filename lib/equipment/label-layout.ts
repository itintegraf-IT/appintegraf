/** A4 pro hromadný tisk štítků majetku / místností */
export const A4_WIDTH_MM = 210;
export const A4_HEIGHT_MM = 297;

/** Zpětná kompatibilita – výchozí vizitka 90×50 mm, 2×5. */
export const LABEL_WIDTH_MM = 90;
export const LABEL_HEIGHT_MM = 50;
export const A4_MARGIN_MM = 8;
export const LABEL_GAP_MM = 3;
export const LABELS_PER_ROW = 2;
export const LABELS_PER_COL = 5;

export type EquipmentLabelGridSpec = {
  cols: number;
  rows: number;
  labelWidthMm: number;
  labelHeightMm: number;
  pageMarginMm: number;
  colGapMm: number;
  rowGapMm: number;
};

export type EquipmentLabelTemplateKey = "visitka_2x5" | "compact_3x7";

export const EQUIPMENT_LABEL_TEMPLATES: Record<
  EquipmentLabelTemplateKey,
  { label: string; spec: EquipmentLabelGridSpec }
> = {
  visitka_2x5: {
    label: "Vizitka 90×50 mm (2×5)",
    spec: {
      cols: LABELS_PER_ROW,
      rows: LABELS_PER_COL,
      labelWidthMm: LABEL_WIDTH_MM,
      labelHeightMm: LABEL_HEIGHT_MM,
      pageMarginMm: A4_MARGIN_MM,
      colGapMm: LABEL_GAP_MM,
      rowGapMm: LABEL_GAP_MM,
    },
  },
  compact_3x7: {
    label: "Kompaktní 60×35 mm (3×7)",
    spec: {
      cols: 3,
      rows: 7,
      labelWidthMm: 60,
      labelHeightMm: 35,
      pageMarginMm: 8,
      colGapMm: 3,
      rowGapMm: 3,
    },
  },
};

export const DEFAULT_EQUIPMENT_LABEL_TEMPLATE: EquipmentLabelTemplateKey = "visitka_2x5";

export function mmToPt(mm: number): number {
  return (mm / 25.4) * 72;
}

export type LabelSlot = {
  x: number;
  y: number;
  widthMm: number;
  heightMm: number;
};

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

export function normalizeEquipmentLabelGridSpec(
  partial: Partial<EquipmentLabelGridSpec> | null | undefined,
  base?: EquipmentLabelGridSpec
): EquipmentLabelGridSpec {
  const b = base ?? getTemplateSpec(DEFAULT_EQUIPMENT_LABEL_TEMPLATE);
  const clamp = (n: unknown, fallback: number, min: number, max: number) => {
    const v = typeof n === "number" ? n : parseFloat(String(n));
    if (!Number.isFinite(v)) return fallback;
    return Math.min(max, Math.max(min, v));
  };
  return {
    cols: Math.round(clamp(partial?.cols, b.cols, 1, 6)),
    rows: Math.round(clamp(partial?.rows, b.rows, 1, 12)),
    labelWidthMm: clamp(partial?.labelWidthMm, b.labelWidthMm, 20, 200),
    labelHeightMm: clamp(partial?.labelHeightMm, b.labelHeightMm, 15, 140),
    pageMarginMm: clamp(partial?.pageMarginMm, b.pageMarginMm, 0, 40),
    colGapMm: clamp(partial?.colGapMm, b.colGapMm, 0, 20),
    rowGapMm: clamp(partial?.rowGapMm, b.rowGapMm, 0, 20),
  };
}

/** Pozice štítků na A4 (pt, origin left-bottom v pdf-lib). */
export function getLabelSlotsOnA4(spec?: EquipmentLabelGridSpec): LabelSlot[] {
  const s = spec ?? getTemplateSpec(DEFAULT_EQUIPMENT_LABEL_TEMPLATE);
  const slots: LabelSlot[] = [];
  const pageH = mmToPt(A4_HEIGHT_MM);
  const margin = mmToPt(s.pageMarginMm);
  const colGap = mmToPt(s.colGapMm);
  const rowGap = mmToPt(s.rowGapMm);
  const w = mmToPt(s.labelWidthMm);
  const h = mmToPt(s.labelHeightMm);

  for (let row = 0; row < s.rows; row++) {
    for (let col = 0; col < s.cols; col++) {
      const x = margin + col * (w + colGap);
      const y = pageH - margin - (row + 1) * h - row * rowGap;
      slots.push({
        x,
        y,
        widthMm: s.labelWidthMm,
        heightMm: s.labelHeightMm,
      });
    }
  }
  return slots;
}
