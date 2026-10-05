import { describe, expect, it } from "vitest";
import {
  DEFAULT_LABEL_OWNER_TEXT,
  fitCodeLines,
  fitTextToWidth,
  labelsCountLabel,
  normalizeLabelOwnerText,
  wrapTextLines,
} from "./label-text";

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

describe("fitCodeLines", () => {
  const sizes = [14, 12, 10, 8, 7];

  it("číslo, které se vejde, zůstane na jednom řádku co největším písmem", () => {
    expect(fitCodeLines("100123", 72, sizes, measureSized)).toEqual({ size: 12, lines: ["100123"] });
  });

  it("dlouhé číslo (40 znaků) se rozdělí na dva řádky — nic se neztratí ani nepřeteče", () => {
    const code = "1234567890".repeat(4);
    const fit = fitCodeLines(code, 160, sizes, measureSized);
    expect(fit).toMatchObject({ size: 8 });
    expect(fit.lines).toHaveLength(2);
    expect(fit.lines.join("")).toBe(code);
    for (const line of fit.lines) expect(measureSized(line, fit.size)).toBeLessThanOrEqual(160);
  });

  it("číslo se nikdy nezkracuje, ani když se nevejde na dva řádky", () => {
    const fit = fitCodeLines("123456789012", 20, sizes, measureSized);
    expect(fit.size).toBe(7);
    expect(fit.lines.join("")).toBe("123456789012");
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

describe("labelsCountLabel", () => {
  it.each([
    [0, "0 štítků"],
    [1, "1 štítek"],
    [3, "3 štítky"],
    [5, "5 štítků"],
    [22, "22 štítků"],
  ] as const)("%i → %s", (n, label) => {
    expect(labelsCountLabel(n)).toBe(label);
  });
});
