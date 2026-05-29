import { describe, it, expect } from "vitest";
import {
  consumptionKg,
  FULL_COVERAGE_KG_PER_1000_SHEETS,
} from "./iml-color-consumption";

/**
 * Kontrolní matice z Přílohy C.1 (závazné příklady).
 * Pokud se cokoli změní, nejdřív aktualizovat specifikaci, pak test, pak kód.
 */
describe("iml-color-consumption.consumptionKg", () => {
  it("má konstantu 1.2 kg / 1000 archů", () => {
    expect(FULL_COVERAGE_KG_PER_1000_SHEETS).toBe(1.2);
  });

  it("100 000 ks, 100 etiket/TA, 100% → 1.2 kg", () => {
    expect(consumptionKg(100_000, 100, 100)).toBe(1.2);
  });

  it("100 000 ks, 100 etiket/TA, 50% → 0.6 kg", () => {
    expect(consumptionKg(100_000, 100, 50)).toBe(0.6);
  });

  it("100 000 ks, 100 etiket/TA, 30% → 0.36 kg", () => {
    expect(consumptionKg(100_000, 100, 30)).toBe(0.36);
  });

  it("50 000 ks, 50 etiket/TA, 100% → 1.2 kg (škáluje lineárně)", () => {
    expect(consumptionKg(50_000, 50, 100)).toBe(1.2);
  });

  it("10 000 ks, 20 etiket/TA, 25% → 0.15 kg", () => {
    expect(consumptionKg(10_000, 20, 25)).toBe(0.15);
  });

  it("0 ks → null (náklad musí být > 0)", () => {
    expect(consumptionKg(0, 100, 50)).toBeNull();
  });

  it("záporný náklad → null", () => {
    expect(consumptionKg(-100, 100, 50)).toBeNull();
  });

  it("labels_per_sheet = 0 → null (chybějící vstup)", () => {
    expect(consumptionKg(100_000, 0, 50)).toBeNull();
  });

  it("labels_per_sheet = null → null", () => {
    expect(consumptionKg(100_000, null, 50)).toBeNull();
  });

  it("labels_per_sheet = undefined → null", () => {
    expect(consumptionKg(100_000, undefined, 50)).toBeNull();
  });

  it("labels_per_sheet = záporný → null", () => {
    expect(consumptionKg(100_000, -10, 50)).toBeNull();
  });

  it("coveragePct = null/záporné → null", () => {
    // Záporné není povoleno. null by TS nedovolil, ale ošetřujeme runtime.
    expect(consumptionKg(100_000, 100, -10)).toBeNull();
    expect(consumptionKg(100_000, 100, NaN)).toBeNull();
  });

  it("coveragePct = 0 → 0 kg (ne null – pokrytí 0% je validní)", () => {
    expect(consumptionKg(100_000, 100, 0)).toBe(0);
  });

  it("vysoké hodnoty nezůsobí overflow, zaokrouhlí se na 4 des. místa", () => {
    // 1 234 567 ks / 123 et/TA ≈ 10 037,13... archů ≈ 12,0446 kg při 100%
    const result = consumptionKg(1_234_567, 123, 100);
    expect(result).not.toBeNull();
    expect(Number.isFinite(result as number)).toBe(true);
    // Výsledek má max 4 desetinná místa (tolerance pro JS floating point)
    const scaled = (result as number) * 10000;
    expect(Math.abs(Math.round(scaled) - scaled)).toBeLessThan(1e-5);
  });
});
