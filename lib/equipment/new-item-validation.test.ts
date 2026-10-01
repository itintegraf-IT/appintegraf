import { describe, expect, it } from "vitest";
import { validateNewItemInput } from "./new-item-validation";

const today = new Date("2026-10-01T10:00:00");
const base = {
  name: " Notebook Dell Latitude ",
  category_id: "3",
  purchase_date: "2026-09-28",
  purchase_price: "24 990,50",
  invoice_number: " FP-2026-0815 ",
};
const opts = { canSetManualTag: false, today };

describe("validateNewItemInput — povinné údaje nákupu", () => {
  it("platný nákup normalizuje cenu, datum a ořízne texty", () => {
    const res = validateNewItemInput(base, opts);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data).toMatchObject({
      name: "Notebook Dell Latitude",
      categoryId: 3,
      purchasePrice: "24990.50",
      invoiceNumber: "FP-2026-0815",
      unitCount: 1,
      serialNumbers: [null],
    });
    expect(res.data.purchaseDate.toISOString().slice(0, 10)).toBe("2026-09-28");
    expect(res.warnings).toEqual([]);
  });

  it.each([
    ["chybí cena", { ...base, purchase_price: "" }],
    ["chybí datum", { ...base, purchase_date: "" }],
    ["chybí doklad", { ...base, invoice_number: "  " }],
    ["chybí název", { ...base, name: "" }],
    ["chybí skupina", { ...base, category_id: "" }],
    ["datum v budoucnu", { ...base, purchase_date: "2026-10-02" }],
    ["neplatné datum", { ...base, purchase_date: "2026-02-30" }],
    ["záporná cena", { ...base, purchase_price: "-5" }],
    ["cena s textem", { ...base, purchase_price: "25 tisíc" }],
    ["cena nad limit sloupce", { ...base, purchase_price: "100000000" }],
    ["doklad přes 100 znaků", { ...base, invoice_number: "x".repeat(101) }],
  ])("%s → odmítne", (_label, body) => {
    expect(validateNewItemInput(body, opts).ok).toBe(false);
  });

  it("dnešní datum a nulová cena (dar) projdou", () => {
    expect(validateNewItemInput({ ...base, purchase_date: "2026-10-01", purchase_price: "0" }, opts).ok).toBe(true);
  });

  it("cenu s tečkou i jako číslo přijme", () => {
    const a = validateNewItemInput({ ...base, purchase_price: "1500.5" }, opts);
    const b = validateNewItemInput({ ...base, purchase_price: 1500.5 }, opts);
    expect(a.ok && a.data.purchasePrice).toBe("1500.50");
    expect(b.ok && b.data.purchasePrice).toBe("1500.50");
  });

  it("od 80 000 Kč upozorní, že odepisovaný majetek patří do ABRA Gen", () => {
    const res = validateNewItemInput({ ...base, purchase_price: "80000" }, opts);
    expect(res.ok && res.warnings.join(" ")).toMatch(/80\s?000/);
    const below = validateNewItemInput({ ...base, purchase_price: "79999.99" }, opts);
    expect(below.ok && below.warnings).toEqual([]);
  });
});

describe("validateNewItemInput — inventární číslo a fond QR", () => {
  it("ruční číslo bez oprávnění odmítne", () => {
    expect(validateNewItemInput({ ...base, manual_asset_tag: "1215" }, opts).ok).toBe(false);
  });

  it("ruční číslo s oprávněním přijme (oříznuté)", () => {
    const res = validateNewItemInput({ ...base, manual_asset_tag: " 1215 " }, { ...opts, canSetManualTag: true });
    expect(res.ok && res.data.manualAssetTag).toBe("1215");
  });

  it.each([
    ["s mezerou", "12 15"],
    ["přes 40 znaků", "x".repeat(41)],
  ])("ruční číslo %s odmítne", (_label, tag) => {
    expect(validateNewItemInput({ ...base, manual_asset_tag: tag }, { ...opts, canSetManualTag: true }).ok).toBe(false);
  });

  it("ruční číslo a kód z fondu najednou odmítne", () => {
    const res = validateNewItemInput(
      { ...base, manual_asset_tag: "1215", pool_qr_code: "123456789012" },
      { ...opts, canSetManualTag: true }
    );
    expect(res.ok).toBe(false);
  });

  it("kód z fondu předá dál", () => {
    const res = validateNewItemInput({ ...base, pool_qr_code: " INTEGRAF:EQ:123456789012 " }, opts);
    expect(res.ok && res.data.poolCode).toBe("INTEGRAF:EQ:123456789012");
  });
});

describe("validateNewItemInput — více kusů", () => {
  it("víc kusů bez sériových čísel projde (např. 5 židlí)", () => {
    const res = validateNewItemInput({ ...base, unit_count: 5, serial_numbers: ["", "", "", "", ""] }, opts);
    expect(res.ok && res.data.unitCount).toBe(5);
    expect(res.ok && res.data.serialNumbers).toEqual([null, null, null, null, null]);
  });

  it("duplicitní sériová čísla odmítne (bez ohledu na velikost písmen)", () => {
    expect(validateNewItemInput({ ...base, unit_count: 2, serial_numbers: ["AB1", "ab1"] }, opts).ok).toBe(false);
  });

  it.each([
    ["0 kusů", 0],
    ["51 kusů", 51],
    ["desetinný počet", 2.5],
  ])("%s odmítne", (_label, count) => {
    expect(validateNewItemInput({ ...base, unit_count: count }, opts).ok).toBe(false);
  });

  it("ruční číslo ani kód z fondu u více kusů nejde", () => {
    expect(
      validateNewItemInput({ ...base, unit_count: 2, manual_asset_tag: "1215" }, { ...opts, canSetManualTag: true }).ok
    ).toBe(false);
    expect(validateNewItemInput({ ...base, unit_count: 2, pool_qr_code: "123456789012" }, opts).ok).toBe(false);
  });

  it("jeden kus přijme sériové číslo z pole serial_number", () => {
    const res = validateNewItemInput({ ...base, serial_number: " SN-1 " }, opts);
    expect(res.ok && res.data.serialNumbers).toEqual(["SN-1"]);
  });
});
