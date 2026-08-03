import { describe, expect, it } from "vitest";
import { parseFrutaOrderText, frutaOrderPdfTemplate } from "./fruta";

/** Texty odpovídají extrakci z reálných PDF Fruta Podivín (Helios Inuvio). */

const SAMPLE_2600445 = `Rybáře 157/40
691 45 Podivín
DIČ IČ 49968556 CZ49968556
Odběratel :
: :
FRUTA Podivín, a.s. Řada dokladu 050
CODE
Číslo dokladu 2600445
:
:
:
Popis dodávky
Způsob dopravy
Zakázka
:
:
:
Forma úhrady :
Telefon : Fax : E-mail :
Místo určení :
Rybáře 157/40
691 45 Podivín
FRUTA Podivín, a.s.
Datum pořízení
Požadované datum dodání
: 13.07.2026
: 27.07.2026
Požadovaný termín dodání :
OBJEDNÁVKA
Dodavatel :
Myslbekova 273
547 01 Náchod
IČ DIČ 47451980 : :
Integraf, s.r.o.
Označení MJ řádek Popis dodávky Cena celkem Množství Jednotková cena
OBL7309900009 5 000,00 ks 0,12 600,00 1 Etiketa 180 ALBA hrubozrnná Etiketa 180 ALBA hrubozrnná
OBL7309900010 5 000,00 ks 0,21 1 042,27 2 Etiketa 180 ALBA medová Etiketa 180 ALBA medová
OBL7309900258 20 000,00 ks 0,49 9 800,00 3 Etiketa 340 NOVOFRUCT KR
OBL7309900259 20 000,00 ks 0,49 9 800,00 4 Etiketa 340 NOVOFRUCT PL
50 000,00 21 242,27
21 242,27 Celkem bez DPH v CZK
Byla zkontrolována čistota ložní plochy.
Prosím o potvrzení objednávky a termínu dodání.
Na faktuře i DL vždy uvádějte číslo objednávky.
Děkuji.
Objednávka :
Vystavil :
050260044
Hudačová Kristýna
Strana: 1 / 1 Zpracováno systémem Helios Inuvio`;

const SAMPLE_2600394 = `Rybáře 157/40
691 45 Podivín
DIČ IČ 49968556 CZ49968556
Odběratel :
: :
FRUTA Podivín, a.s. Řada dokladu 050
CODE
Číslo dokladu 2600394
:
:
:
Popis dodávky
Způsob dopravy
Zakázka
:
:
:
Forma úhrady :
Telefon : Fax : E-mail :
Místo určení :
Rybáře 157/40
691 45 Podivín
FRUTA Podivín, a.s.
Datum pořízení
Požadované datum dodání
: 12.06.2026
: 26.06.2026
Požadovaný termín dodání :
OBJEDNÁVKA
Dodavatel :
Myslbekova 273
547 01 Náchod
IČ DIČ 47451980 : :
Integraf, s.r.o.
Označení MJ řádek Popis dodávky Cena celkem Množství Jednotková cena
OBL7309900079 10 000,00 ks 0,07 650,00 1 Etiketa 340 USA PL 8594000771272
OBL7309900126 20 000,00 ks 0,40 8 000,00 2 Etiketa 180 ALBA dijonská Etiketa 180 ALBA dijonská
OBL7309900232 10 000,00 ks 0,20 1 981,57 3 Etiketa 340 USA KR 8594000771333
40 000,00 10 631,57
10 631,57 Celkem bez DPH v CZK
Byla zkontrolována čistota ložní plochy.
Prosím o potvrzení objednávky a termínu dodání.
Na faktuře i DL vždy uvádějte číslo objednávky.
Děkuji.
Objednávka :
Vystavil :
050260039
Hudačová Kristýna
Strana: 1 / 1 Zpracováno systémem Helios Inuvio`;

describe("parseFrutaOrderText", () => {
  it("parsuje objednávku 0502600445 (4 položky OBL)", () => {
    const r = parseFrutaOrderText(SAMPLE_2600445);
    expect(r.orderNumber).toBe("0502600445");
    expect(r.orderDate).toBe("2026-07-13");
    expect(r.currency).toBe("CZK");
    expect(r.totalAmount).toBe(21242.27);
    expect(r.items).toHaveLength(4);

    expect(r.items[0]).toMatchObject({
      itemNo: "1",
      customerMaterialNo: "OBL7309900009",
      quantity: 5000,
      price: 0.12,
      priceBasis: 1,
      netAmount: 600,
      deliveryDate: "2026-07-27",
    });
    expect(r.items[0].description).toContain("ALBA hrubozrnná");

    expect(r.items[1]).toMatchObject({
      itemNo: "2",
      customerMaterialNo: "OBL7309900010",
      quantity: 5000,
      price: 0.21,
      netAmount: 1042.27,
    });

    expect(r.items[2].customerMaterialNo).toBe("OBL7309900258");
    expect(r.items[2].quantity).toBe(20000);
    expect(r.items[2].netAmount).toBe(9800);

    expect(r.items[3].customerMaterialNo).toBe("OBL7309900259");
    expect(r.notes).toContain("Prosím o potvrzení");
  });

  it("parsuje objednávku 0502600394 (3 položky OBL)", () => {
    const r = parseFrutaOrderText(SAMPLE_2600394);
    expect(r.orderNumber).toBe("0502600394");
    expect(r.orderDate).toBe("2026-06-12");
    expect(r.items).toHaveLength(3);
    expect(r.items[0]).toMatchObject({
      customerMaterialNo: "OBL7309900079",
      quantity: 10000,
      price: 0.07,
      netAmount: 650,
      deliveryDate: "2026-06-26",
    });
    expect(r.items[1].customerMaterialNo).toBe("OBL7309900126");
    expect(r.items[1].quantity).toBe(20000);
    expect(r.items[2].customerMaterialNo).toBe("OBL7309900232");
    expect(r.totalAmount).toBe(10631.57);
  });

  it("detect rozpozná Fruta Podivín", () => {
    expect(frutaOrderPdfTemplate.detect(SAMPLE_2600445)).toBe(true);
    expect(frutaOrderPdfTemplate.detect("Purchase Order Orkla")).toBe(false);
  });
});
