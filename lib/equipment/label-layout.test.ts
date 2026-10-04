import { describe, expect, it } from "vitest";
import {
  A4_HEIGHT_MM,
  DEFAULT_EQUIPMENT_LABEL_TEMPLATE,
  getLabelSlotsOnA4,
  getTemplateSpec,
  labelContentBox,
  labelGridFitError,
  labelsPerPage,
  mmToPt,
  normalizeEquipmentLabelGridSpec,
  planLabelSheets,
  validateStartPosition,
  type EquipmentLabelGridSpec,
} from "./label-layout";

const sheet70x37: EquipmentLabelGridSpec = {
  cols: 3,
  rows: 8,
  labelWidthMm: 70,
  labelHeightMm: 37,
  marginTopMm: 0.5,
  marginLeftMm: 0,
  colGapMm: 0,
  rowGapMm: 0,
};

describe("šablony", () => {
  it("výchozí je arch 70 × 37 mm, 3 × 8", () => {
    expect(DEFAULT_EQUIPMENT_LABEL_TEMPLATE).toBe("a4_70x37_3x8");
    expect(getTemplateSpec(DEFAULT_EQUIPMENT_LABEL_TEMPLATE)).toEqual(sheet70x37);
    expect(labelsPerPage(sheet70x37)).toBe(24);
  });
});

describe("normalizeEquipmentLabelGridSpec", () => {
  it("starý jeden okraj pageMarginMm použije pro horní i levý", () => {
    const spec = normalizeEquipmentLabelGridSpec({ cols: 2, rows: 5, labelWidthMm: 90, labelHeightMm: 50, pageMarginMm: 8, colGapMm: 3, rowGapMm: 3 } as never);
    expect(spec.marginTopMm).toBe(8);
    expect(spec.marginLeftMm).toBe(8);
  });

  it("nové okraje mají přednost před starým", () => {
    const spec = normalizeEquipmentLabelGridSpec({ ...sheet70x37, pageMarginMm: 8 } as never);
    expect(spec.marginTopMm).toBe(0.5);
    expect(spec.marginLeftMm).toBe(0);
  });

  it("nesmysl nahradí hodnotou ze základu a mimo rozsah ořízne", () => {
    const spec = normalizeEquipmentLabelGridSpec({ cols: "x" as never, rows: 99, marginTopMm: -5 }, sheet70x37);
    expect(spec.cols).toBe(3);
    expect(spec.rows).toBe(12);
    expect(spec.marginTopMm).toBe(0);
  });
});

describe("labelGridFitError", () => {
  it("přesně 210 mm na šířku projde", () => {
    expect(labelGridFitError(sheet70x37)).toBeNull();
  });

  it("o setinu milimetru víc neprojde a řekne proč", () => {
    expect(labelGridFitError({ ...sheet70x37, marginLeftMm: 0.01 })).toMatch(/šířk/);
  });

  it("příliš vysoká mřížka neprojde", () => {
    expect(labelGridFitError({ ...sheet70x37, rows: 9 })).toMatch(/výšk/);
  });
});

describe("labelContentBox", () => {
  const opts = { paperSafeMm: 4, paddingMm: 2 };

  it("levý horní štítek drží odstup 4 mm od okraje papíru", () => {
    expect(labelContentBox(sheet70x37, 0, opts)).toEqual({ xMm: 4, yMm: 4, wMm: 64, hMm: 31.5 });
  });

  it("prostřední štítek má jen vnitřní okraj 2 mm", () => {
    expect(labelContentBox(sheet70x37, 4, opts)).toEqual({ xMm: 72, yMm: 39.5, wMm: 66, hMm: 33 });
  });

  it("pravý dolní štítek drží odstup od pravého i dolního okraje papíru", () => {
    expect(labelContentBox(sheet70x37, 23, opts)).toEqual({ xMm: 142, yMm: 261.5, wMm: 64, hMm: 31.5 });
  });
});

describe("getLabelSlotsOnA4", () => {
  it("první štítek začíná na levém a horním okraji (pt, počátek vlevo dole)", () => {
    const [first] = getLabelSlotsOnA4({ ...sheet70x37, marginLeftMm: 5, marginTopMm: 10 });
    expect(first.x).toBeCloseTo(mmToPt(5));
    expect(first.y).toBeCloseTo(mmToPt(A4_HEIGHT_MM - 10 - 37));
  });
});

describe("planLabelSheets a validateStartPosition", () => {
  const entries = Array.from({ length: 20 }, (_, i) => i + 1);

  it("start 1 začne prvním políčkem", () => {
    expect(planLabelSheets(entries.slice(0, 1), sheet70x37, 1)).toEqual([{ page: 0, slot: 0, entry: 1 }]);
  });

  it("start 8 začne osmým políčkem a zbytek přeteče na další stránku", () => {
    const plan = planLabelSheets(entries, sheet70x37, 8);
    expect(plan[0]).toEqual({ page: 0, slot: 7, entry: 1 });
    expect(plan.filter((p) => p.page === 0)).toHaveLength(17);
    expect(plan[17]).toEqual({ page: 1, slot: 0, entry: 18 });
    expect(plan.at(-1)).toEqual({ page: 1, slot: 2, entry: 20 });
  });

  it("start na posledním políčku archu", () => {
    expect(planLabelSheets([1], sheet70x37, 24)).toEqual([{ page: 0, slot: 23, entry: 1 }]);
  });

  it.each([
    ["8", { ok: true, value: 8 }],
    [8, { ok: true, value: 8 }],
    [undefined, { ok: true, value: 1 }],
    ["", { ok: true, value: 1 }],
  ] as const)("validateStartPosition(%j) → %j", (raw, expected) => {
    expect(validateStartPosition(raw, 24)).toEqual(expected);
  });

  it.each([[0], [25], ["abc"], [2.5]])("validateStartPosition(%j) → chyba", (raw) => {
    const result = validateStartPosition(raw, 24);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("1–24");
  });
});
