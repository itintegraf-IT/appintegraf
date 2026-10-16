import { describe, expect, it } from "vitest";
import {
  autoMapShapeColumns,
  mapShapeTypeLabel,
  parseFormatMm,
  parseFormatMmFromNote,
  parseShapeImportRow,
  resolveImportTechnology,
  splitCustomerNames,
} from "@/lib/iml/shapes-import";

describe("parseFormatMm", () => {
  it("parsuje čárku a x", () => {
    expect(parseFormatMm("94,86 x 112")).toEqual({
      width_mm: 94.86,
      height_mm: 112,
    });
  });

  it("parsuje 69x102", () => {
    expect(parseFormatMm("69x102")).toEqual({ width_mm: 69, height_mm: 102 });
  });

  it("vrátí null pro kód A08781", () => {
    expect(parseFormatMm("A08781")).toBeNull();
  });
});

describe("parseFormatMmFromNote", () => {
  it("pár z závorky", () => {
    expect(
      parseFormatMmFromNote("Víčko - Les Glaces (109,7x69,35mm)")
    ).toEqual({ width_mm: 109.7, height_mm: 69.35 });
  });

  it("kruh ?80,5mm", () => {
    expect(
      parseFormatMmFromNote("Kolečko SFA - ?80,5mm (redukce na 80,1mm)")
    ).toEqual({ width_mm: 80.5, height_mm: 80.5 });
  });
});

describe("mapShapeTypeLabel", () => {
  it("mapuje vanička/víčko", () => {
    expect(mapShapeTypeLabel("vanička", "X")).toBe("CUP");
    expect(mapShapeTypeLabel("víčko", "X")).toBe("LID");
  });

  it("odvodí z kódu", () => {
    expect(mapShapeTypeLabel("neurčeno", "IML-CUP-001")).toBe("CUP");
    expect(mapShapeTypeLabel("", "IML-LID-080")).toBe("LID");
  });
});

describe("resolveImportTechnology", () => {
  it("železo na protlačovák", () => {
    expect(resolveImportTechnology("železo na protlačovák")).toBe(
      "PROTLACOVAK_RUCNI"
    );
  });
});

describe("splitCustomerNames", () => {
  it("rozdělí seznam", () => {
    expect(splitCustomerNames("Vavřík, Dostál, Váhala")).toEqual([
      "Vavřík",
      "Dostál",
      "Váhala",
    ]);
  });
});

describe("autoMap + parseShapeImportRow", () => {
  const headers = [
    "kód",
    "nástroj",
    "fórmát",
    "hmotnost",
    "typ krabice",
    "materiál",
    "Sloupec 9",
    "Sloupec 10",
    "typ",
  ];
  const mapping = autoMapShapeColumns(headers);

  it("auto-mapuje Excel CUP/LID", () => {
    expect(mapping.shape_code).toBe(0);
    expect(mapping.tool_code).toBe(1);
    expect(mapping.format).toBe(2);
    expect(mapping.technology).toBe(6);
    expect(mapping.customers).toBe(7);
    expect(mapping.shape_type).toBe(8);
  });

  it("parsuje běžný řádek CUP", () => {
    const row = [
      "IML-CUP-001",
      "0001B",
      "94,86 x 112",
      "",
      "",
      "",
      "železo na protlačovák",
      "PIKOK",
      "vanička",
    ];
    const parsed = parseShapeImportRow(row, mapping);
    expect("error" in parsed).toBe(false);
    if ("error" in parsed) return;
    expect(parsed.shape_code).toBe("IML-CUP-001");
    expect(parsed.tool_code).toBe("0001B");
    expect(parsed.width_mm).toBe(94.86);
    expect(parsed.height_mm).toBe(112);
    expect(parsed.shape_type).toBe("CUP");
    expect(parsed.customer_names).toEqual(["PIKOK"]);
    expect(parsed.technology).toBe("PROTLACOVAK_RUCNI");
  });

  it("parsuje LID bez formátu přes poznámku", () => {
    const row = [
      "IML-LID-080",
      "A53A",
      "A08781",
      "",
      "",
      "",
      "železo na protlačovák",
      "Kolečko SFA - ?80,5mm (redukce na 80,1mm)",
      "víčko",
    ];
    const parsed = parseShapeImportRow(row, mapping);
    expect("error" in parsed).toBe(false);
    if ("error" in parsed) return;
    expect(parsed.width_mm).toBe(80.5);
    expect(parsed.height_mm).toBe(80.5);
    expect(parsed.format_from_note).toBe(true);
  });
});
