import { describe, expect, it } from "vitest";
import { parsePrimatorOrderText, primatorOrderPdfTemplate } from "./primator";
import { detectOrderPdfTemplate } from "./registry";

/** Text odpovídá extrakci z primator_objednavka-9000508.pdf (pdf-parse). */
const SAMPLE_9000508 = `Číslo: 	IČO:
Datum: 12.08.2026 06:37
PRIMÁTOR a.s.
47468661	IČO:
Dodavatel
903473
Expozitura
47451980
12.08.2026 00:00:00 	Novák Pavel
Schválil (realizoval):
Vyřizuje (zavedl):
OR HK, vložka B892
Datum vystavení / realizace:
Měna: 	1 /
9000508
Název zboží	Číslo zboží 	Množství MJ 	Jednotk. cena Cena základ dodání
Objednávka zboží číslo:
Odběratel
Zavedeno
INTEGRAF, s.r.o.
Ulice:
PSČ: 	Místo: Náchod	547 01
Dobrošovská 130 	Myslbekova 273
54701 Náchod
Datum
Etiketa IPA přední	M69401 	tks 	0,0000 	0,00	300,
Etiketa PITO přední	M67001 	tks 	0,0000 	0,00	50,
Etiketa IPA zadní CZ, SK, PL	M69420 	tks 	0,0000 	0,00	150,
Etiketa PITO zadní CZ, SK, PL	M67020 	tks 	0,0000 	0,00	50,
Etiketa 12% zadní CZ, HU, GR	M61221 	tks 	0,0000 	0,00	30,
Etiketa Medové pivo přední	M63302 	tks 	0,0000 	0,00	60,
Etiketa Medové pivo zadní CZ, SK, PL	M63322 	tks 	0,0000 	0,00	60,
Etiketa 12% Fest Hořká přední	M61212 	tks 	0,0000 	0,00	100,
Etiketa 12% Fest Hořká zadní	M61244 	tks 	0,0000 	0,00	100,
Etiketa limo - Bezinka přední	M23308 	tks 	0,0000 	0,00	60,
Etiketa limo - Bezinka zadní	M23315 	tks 	0,0000 	0,00	50,
1 010,
Vystavil/a: Pavel Novák
pavel.novak@primator.cz
Strana : 1/1`;

describe("parsePrimatorOrderText", () => {
  it("parsuje objednávku 9000508 (11 položek M…)", () => {
    const r = parsePrimatorOrderText(SAMPLE_9000508);
    expect(r.orderNumber).toBe("9000508");
    expect(r.orderDate).toBe("2026-08-12");
    expect(r.currency).toBe("CZK");
    expect(r.items).toHaveLength(11);

    expect(r.items[0]).toMatchObject({
      itemNo: "00001",
      customerMaterialNo: "M69401",
      yourMaterialNo: null,
      quantity: 300000,
      price: 0,
      priceBasis: 1,
      description: "Etiketa IPA přední",
    });

    expect(r.items[2]).toMatchObject({
      customerMaterialNo: "M69420",
      quantity: 150000,
    });
    expect(r.items[2].description).toContain("IPA zadní");

    expect(r.items[10]).toMatchObject({
      customerMaterialNo: "M23315",
      quantity: 50000,
    });

    const qtySum = r.items.reduce((s, it) => s + (it.quantity ?? 0), 0);
    expect(qtySum).toBe(1_010_000);
    expect(r.warnings.some((w) => /tks/i.test(w))).toBe(true);

    expect(r.notes).toContain("primator.cz");
  });

  it("detect rozpozná Primátor", () => {
    expect(primatorOrderPdfTemplate.detect(SAMPLE_9000508)).toBe(true);
    expect(primatorOrderPdfTemplate.detect("Purchase Order Orkla")).toBe(false);
    expect(detectOrderPdfTemplate(SAMPLE_9000508)?.key).toBe("primator");
  });
});
