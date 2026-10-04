import { describe, expect, it } from "vitest";
import { DEFAULT_LABEL_OWNER_TEXT, fitFontSize, fitTextToWidth, normalizeLabelOwnerText, wrapTextLines } from "./label-text";

/** Každý znak = 1 jednotka šířky (při velikosti písma 1). */
const measure = (s: string) => s.length;
const measureSized = (s: string, size: number) => s.length * size;

describe("fitTextToWidth", () => {
  it("krátký text nechá", () => {
    expect(fitTextToWidth("Monitor", 10, measure)).toBe("Monitor");
  });

  it("dlouhý text zkrátí s „…“ a nepřekročí šířku", () => {
    const out = fitTextToWidth("Kancelářská židle otočná", 10, measure);
    expect(out.endsWith("…")).toBe(true);
    expect(measure(out)).toBeLessThanOrEqual(10);
    expect(out).toBe("Kancelářs…");
  });

  it("diakritika se počítá jako znak", () => {
    expect(fitTextToWidth("Žluťoučký kůň", 6, measure)).toBe("Žluťo…");
  });

  it("prázdný text a nulová šířka", () => {
    expect(fitTextToWidth("", 10, measure)).toBe("");
    expect(fitTextToWidth("Monitor", 0, measure)).toBe("");
  });

  it("nezačne ani nekončí mezerou", () => {
    expect(fitTextToWidth("Stůl pracovní", 6, measure)).toBe("Stůl…");
  });
});

describe("wrapTextLines", () => {
  it("krátký text na jeden řádek", () => {
    expect(wrapTextLines("Monitor Dell", 20, 2, measure)).toEqual(["Monitor Dell"]);
  });

  it("zalomí po slovech", () => {
    expect(wrapTextLines("Kancelářská židle otočná", 12, 2, measure)).toEqual(["Kancelářská", "židle otočná"]);
  });

  it("co se nevejde do posledního řádku, zkrátí s „…“", () => {
    const lines = wrapTextLines("Stůl kancelářský rohový levý s kontejnerem", 12, 2, measure);
    expect(lines).toHaveLength(2);
    expect(lines[0]).toBe("Stůl");
    expect(lines[1].endsWith("…")).toBe(true);
    expect(measure(lines[1])).toBeLessThanOrEqual(12);
  });

  it("příliš dlouhé slovo rozdělí", () => {
    const lines = wrapTextLines("DOCHAZKOVYSYSTEMTERMINAL", 10, 2, measure);
    expect(lines[0]).toBe("DOCHAZKOVY");
    expect(measure(lines[1])).toBeLessThanOrEqual(10);
  });

  it("prázdný text → žádné řádky", () => {
    expect(wrapTextLines("   ", 10, 2, measure)).toEqual([]);
  });
});

describe("fitFontSize", () => {
  const sizes = [14, 12, 10, 8, 7];

  it("vybere největší velikost, která se vejde", () => {
    expect(fitFontSize("100123", 72, sizes, measureSized)).toBe(12);
  });

  it("když se nevejde ani nejmenší, vrátí nejmenší (číslo se nikdy nezkracuje)", () => {
    expect(fitFontSize("123456789012", 40, sizes, measureSized)).toBe(7);
  });
});

describe("normalizeLabelOwnerText", () => {
  it("chybějící hodnota → výchozí text vlastníka", () => {
    expect(normalizeLabelOwnerText(undefined)).toBe(DEFAULT_LABEL_OWNER_TEXT);
    expect(DEFAULT_LABEL_OWNER_TEXT).toBe("Majetek Integraf, s.r.o.");
  });

  it("ořízne mezery a délku na 40 znaků", () => {
    expect(normalizeLabelOwnerText("  Majetek firmy  ")).toBe("Majetek firmy");
    expect(normalizeLabelOwnerText("x".repeat(50))).toHaveLength(40);
  });

  it("prázdný text = bez řádku vlastníka", () => {
    expect(normalizeLabelOwnerText("")).toBe("");
    expect(normalizeLabelOwnerText("   ")).toBe("");
  });

  it("jiný typ než text → výchozí", () => {
    expect(normalizeLabelOwnerText(42)).toBe(DEFAULT_LABEL_OWNER_TEXT);
  });
});
