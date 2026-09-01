import { describe, expect, it } from "vitest";
import { parsePsPlastyOrderText } from "./psplasty";
import { parseSfaOrderText } from "./sfa";
import { parseJepaOrderText } from "./jepa";
import { parseJokeyOrderText } from "./jokey";
import { detectOrderPdfTemplate } from "./registry";

describe("parsePsPlastyOrderText", () => {
  it("parsuje VO objednávku s položkami a množstvími", () => {
    const text = `OBJEDNÁVKA \tVO-2025-001969
Číslo dokladu.: \tVO-2025-001969
Datum: \t17.10.2025
PS PLASTY CZ s.r.o.
Popis \tČíslo \tCena za jedn. \tCena bez DPH \tDPH \tCena celekm:\tMnožství
18751 \tks\t1 000
000,00
IML ZORBA, \tSmetanový jogurt bílý
10%, \tMlékárna Stříbro na kbelík
0,33 \t330 000,00 \t21,00 \t0,00\t% \t330 000,00
17394 \tks\t27 000,00\tIML Gastro servis, \tPomazankové
tradiční \t1 kg
0,33 \t8 910,00 \t21,00 \t0,00\t% \t8 910,00
Cena celkem bez DPH
495 880,00
CZK
Celkem DPH
104 134,80
Cena IML, \tnákld \t1 130 000 ks - 0,44 \tkč \t/ set. IML etikety, \tprosím poslat do PS Plasty, \tDěkuji.`;

    const r = parsePsPlastyOrderText(text);
    expect(r.orderNumber).toBe("VO-2025-001969");
    expect(r.orderDate).toBe("2025-10-17");
    expect(r.items.length).toBeGreaterThanOrEqual(2);
    expect(r.items[0].yourMaterialNo).toBe("18751");
    expect(r.items[0].quantity).toBe(1000000);
    expect(r.items[0].price).toBe(0.33);
    expect(r.items[0].netAmount).toBe(330000);
    expect(r.items[1].yourMaterialNo).toBe("17394");
    expect(r.items[1].quantity).toBe(27000);
    expect(r.notes).toContain("PS Plasty");
  });

  it("parsuje layout B s Kódem IG v popisu a Číslem zákazníka", () => {
    const text = `OBJEDNÁVKA VO-2026-002100
Číslo dokladu.: VO-2026-002100
Datum: 1.9.2026
PS PLASTY CZ s.r.o.
Popis Číslo Množství Cena za jedn. Cena bez DPH DPH Cena celkem:
IML HASOFT STAVLEP - kbelík kulatý 1 180 ml, PP, s ručkou - červený 02-03-323 (08/26) AK2
10828
1 500,00 ks
0,81 1 215,00 21,00 0,00 1 215,00
IML HASOFT STĚNUSPRAV - kbelík kulatý 1 180 ml, PP, s ručkou - červený 02-03-324 (08/26) AK2
19600
30 000,00 ks
0,81 24 300,00 21,00 0,00 24 300,00
IML STACHEMA ADHÉZNÍ MŮSTEK - kbelík kulatý 1 180 ml, PP, s ručkou - bílý 02-03-494 (08/26) AK2
10725
5 000,00 ks
0,81 4 050,00 21,00 0,00 4 050,00
Cena celkem bez DPH
39 285,00
CZK
Celkem DPH
8 249,85
Celkem s DPH
47 534,85
Prosím poslat do PS EUROPLAST. Cena za kus IML 0,810Kč.`;

    const r = parsePsPlastyOrderText(text);
    expect(r.orderNumber).toBe("VO-2026-002100");
    expect(r.orderDate).toBe("2026-09-01");
    expect(r.items.length).toBe(3);
    expect(r.items[0].yourMaterialNo).toBe("02-03-323");
    expect(r.items[0].customerMaterialNo).toBe("10828");
    expect(r.items[0].quantity).toBe(1500);
    expect(r.items[0].price).toBe(0.81);
    expect(r.items[0].netAmount).toBe(1215);
    expect(r.items[1].yourMaterialNo).toBe("02-03-324");
    expect(r.items[1].customerMaterialNo).toBe("19600");
    expect(r.items[1].quantity).toBe(30000);
    expect(r.items[2].yourMaterialNo).toBe("02-03-494");
    expect(r.items[2].customerMaterialNo).toBe("10725");
    expect(r.notes).toContain("PS EUROPLAST");
  });

  it("parsuje layout B na jednom řádku", () => {
    const text = `OBJEDNÁVKA VO-2026-002100
Datum: 1.9.2026
Popis Číslo Množství Cena za jedn. Cena bez DPH DPH Cena celkem:
IML HASOFT STAVLEP - kbelík 02-03-323 (08/26) AK2 10828 1 500,00 ks 0,81 1 215,00 21,00 0,00 1 215,00
Cena celkem bez DPH
1 215,00`;

    const r = parsePsPlastyOrderText(text);
    expect(r.items.length).toBe(1);
    expect(r.items[0].yourMaterialNo).toBe("02-03-323");
    expect(r.items[0].customerMaterialNo).toBe("10828");
    expect(r.items[0].quantity).toBe(1500);
    expect(r.items[0].price).toBe(0.81);
  });
});

describe("parseSfaOrderText", () => {
  it("parsuje SFA PURCHASE ORDER", () => {
    const text = `SFA Packaging B.V.
PURCHASE ORDER
Page : 1 / 1
IK251631
1805
20-10-2025
EUR
Product \tSFAcode \tDescription \tQuantity \tUnit \tDelivery
403583 \t403583 \tIML bak 750ml Primar Bacalao \t25.000 \tPcs \t13-11-2025
Packaging: 25.000 EURO single use x \t1pcs (Non-Stackable)
403584 \t403584 \tIML bak 750ml Primar Viltgryte \t75.000 \tPcs \t13-11-2025
Packaging: 75.000 EURO single use x \t1pcs (Non-Stackable)`;

    const r = parseSfaOrderText(text);
    expect(r.orderNumber).toBe("IK251631");
    expect(r.orderDate).toBe("2025-10-20");
    expect(r.currency).toBe("EUR");
    expect(r.items).toHaveLength(2);
    expect(r.items[0].customerMaterialNo).toBe("403583");
    expect(r.items[0].quantity).toBe(25000);
    expect(r.items[0].deliveryDate).toBe("2025-11-13");
    expect(r.items[1].quantity).toBe(75000);
  });
});

describe("parseJepaOrderText", () => {
  it("parsuje JEPA objednávku a bere jen položky s množstvím", () => {
    const text = `OBJEDNÁVKA č.: \t25096
ze dne: \t13.10.2025
03.11.2025
JEPA Plastics a.s. \tIntegraf, s.r.o.
04-03-040 JME3502 Bio Matylda bílá \t- \tks 0,195 \t-
01-03-107 JME3590 Kozí jog. bílý BIO \t80 000 ks 0,195 \t15 600,00
04-03-110 JME3593 Kozí jog. jahoda \t20 000 ks 0,195 \t3 900,00
NOVÝ \tJME3591 Kozí jog. bifido bílý BIO \t- \tks 0,195 \t-
Celkem Kč bez DPH 23 400,00
Místo dodání: \tJEPA Plastics a.s., Bělá 99`;

    const r = parseJepaOrderText(text);
    expect(r.orderNumber).toBe("25096");
    expect(r.orderDate).toBe("2025-10-13");
    expect(r.totalAmount).toBe(23400);
    expect(r.items).toHaveLength(2);
    expect(r.items[0].yourMaterialNo).toBe("01-03-107");
    expect(r.items[0].customerMaterialNo).toBe("JME3590");
    expect(r.items[0].quantity).toBe(80000);
    expect(r.items[0].price).toBe(0.195);
    expect(r.items[0].netAmount).toBe(15600);
    expect(r.items[0].deliveryDate).toBe("2025-11-03");
    expect(r.items[1].quantity).toBe(20000);
  });
});

describe("parseJokeyOrderText", () => {
  it("parsuje Jokey Request s položkami", () => {
    const text = `Your Contact Person
AbgabeTermin 24.10.2025
Jokey Praha CZ s.r.o
22.10.2025\tRequest Nr. AN121853 / 499542
Attention: Please calculate each position separately!
Currency\tPlant Delivery Date\tQuantity\tDescription\tItem\tPos.
EUR\tCZ\tJET 56P crystal 100\t1 879170 22.000 pcs
material: clear gloss
Varnish: waterbased
Colours: CMYK + pant. 7505 + double white
Customer FOOD
EUR\tSR\tJETB 11 transparent 100\t2 863165 13.000 pcs
material: clear gloss
Customer FOOD
EUR\tCZ\tIML JETS 250_BOTTOM 870 crystal 100\t4 8004352 212.000 pcs
material: orange peel
Customer FOOD`;

    const r = parseJokeyOrderText(text);
    expect(r.orderNumber).toBe("AN121853");
    expect(r.orderDate).toBe("2025-10-22");
    expect(r.currency).toBe("EUR");
    expect(r.items.length).toBeGreaterThanOrEqual(3);
    expect(r.items[0].description).toBe("JET 56P crystal 100");
    expect(r.items[0].customerMaterialNo).toBe("879170");
    expect(r.items[0].quantity).toBe(22000);
    expect(r.items[0].deliveryDate).toBe("2025-10-24");
    expect(r.items[2].customerMaterialNo).toBe("8004352");
    expect(r.items[2].quantity).toBe(212000);
  });
});

describe("detectOrderPdfTemplate", () => {
  it("rozpozná šablony", () => {
    expect(detectOrderPdfTemplate("Purchase Order 4500210202\nOrkla Foods")?.key).toBe("orkla");
    expect(detectOrderPdfTemplate("OBJEDNÁVKA VO-2025-001969\nPS PLASTY")?.key).toBe("psplasty");
    expect(detectOrderPdfTemplate("Prosím poslat do PS EUROPLAST")?.key).toBe("psplasty");
    expect(detectOrderPdfTemplate("SFA Packaging B.V.\nPURCHASE ORDER\nIK251631")?.key).toBe("sfa");
    expect(detectOrderPdfTemplate("OBJEDNÁVKA č.: 25096\nJEPA Plastics")?.key).toBe("jepa");
    expect(detectOrderPdfTemplate("Request Nr. AN121853\nJokey Praha")?.key).toBe("jokey");
    expect(
      detectOrderPdfTemplate("FRUTA Podivín, a.s.\nOBJEDNÁVKA\nČíslo dokladu 2600445")?.key
    ).toBe("fruta");
    expect(
      detectOrderPdfTemplate("PRIMÁTOR a.s.\nObjednávka zboží číslo:\n9000508\npavel.novak@primator.cz")
        ?.key
    ).toBe("primator");
  });
});
