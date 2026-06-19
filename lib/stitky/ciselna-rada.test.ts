import { describe, expect, it } from "vitest";
import { calcLabelsPerPage, generateLabels } from "@/lib/stitky/ciselna-rada";

const standardTemplate = {
  key: "Standard",
  sheetKey: "Standard",
  rowStart: 2,
  rowStep: 7,
  rowEnd: 49,
  colStart: 1,
  colStep: 4,
  colEnd: 6,
};

describe("generateLabels", () => {
  it("100000 ks / balení 1000 bez řady → 100 štítků", () => {
    const r = generateLabels(
      {
        rowIndex: 1,
        quantity: 100000,
        packSize: 1000,
        text1: "Test",
        text2: "A4",
        text3: "",
      },
      standardTemplate,
      "A17984",
      "Standard"
    );
    const totalLabels = r.pages.reduce((s, p) => s + p.length, 0);
    expect(totalLabels).toBe(100);
  });

  it("leading zeros v rozsahu", () => {
    const r = generateLabels(
      {
        rowIndex: 1,
        quantity: 1000,
        packSize: 1,
        text1: "x",
        text2: "",
        text3: "",
        rangeFrom: "000001",
        rangeTo: "001000",
      },
      standardTemplate,
      "A1",
      "Standard"
    );
    expect(r.pages[0][0].rangeLabel).toBe("Řada:  000001 - 000001");
  });

  it("Oriflame barcodeData", () => {
    const r = generateLabels(
      {
        rowIndex: 1,
        quantity: 100,
        packSize: 100,
        text1: "152372.1",
        text2: "Popis",
      },
      { ...standardTemplate, rowStep: 9, rowEnd: 34, colStep: 5, colEnd: 9 },
      "A1",
      "Oriflame"
    );
    expect(r.pages[0][0].barcodeData).toBe("(92)152372.1(37)100");
  });
});

describe("calcLabelsPerPage", () => {
  it("Standard layout = 14 štítků", () => {
    expect(calcLabelsPerPage(standardTemplate)).toBe(14);
  });
});
