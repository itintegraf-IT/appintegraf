/** Rozměry vizitkového štítku majetku / místnosti (mm). */
export const LABEL_WIDTH_MM = 90;
export const LABEL_HEIGHT_MM = 50;

/** A4 pro hromadný tisk */
export const A4_WIDTH_MM = 210;
export const A4_HEIGHT_MM = 297;
export const A4_MARGIN_MM = 8;
export const LABEL_GAP_MM = 3;

export const LABELS_PER_ROW = 2;
export const LABELS_PER_COL = 5;

export function mmToPt(mm: number): number {
  return (mm / 25.4) * 72;
}

export type LabelSlot = { x: number; y: number };

/** Pozice vizitek na A4 stránce (pt, origin left-bottom v pdf-lib). */
export function getLabelSlotsOnA4(): LabelSlot[] {
  const slots: LabelSlot[] = [];
  const pageH = mmToPt(A4_HEIGHT_MM);
  const margin = mmToPt(A4_MARGIN_MM);
  const gap = mmToPt(LABEL_GAP_MM);
  const w = mmToPt(LABEL_WIDTH_MM);
  const h = mmToPt(LABEL_HEIGHT_MM);

  for (let row = 0; row < LABELS_PER_COL; row++) {
    for (let col = 0; col < LABELS_PER_ROW; col++) {
      const x = margin + col * (w + gap);
      const y = pageH - margin - (row + 1) * h - row * gap;
      slots.push({ x, y });
    }
  }
  return slots;
}
