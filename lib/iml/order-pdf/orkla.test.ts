import { describe, expect, it } from "vitest";
import { parseOrklaOrderText } from "./orkla";

/** Texty odpovídají extrakci ze tří reálných PDF objednávek Orkla (zkráceno o boilerplate). */

const HEADER = `Page 1 / 2
Purchase Order {ORDER}
Orkla Foods Česko a
Slovensko, a.s.
Postal Address
Mělnická 133
CZ-277 32 Byšice
Visitor Address (HQ)
Mělnická 133
CZ-277 32 Byšice
Phone : \tOrg. no.:
VAT reg. no.
CZ14803691
Integraf, s.r.o.
Myslbekova 273
547 01 Náchod
Delivery address
Company
Orkla Foods Česko
Melnicka 133
277 32 Bysice
Invoice Address
edi.invoice@orkla.cz
Order date: \t{DATE}
Our reference: \tMiluše Löbelová
Terms of payment: \t30 days net
Terms of delivery: \tDDP Orkla factory
Currency: \tCZK
According to Legal Contract no:
Please send order confirmation to:
miluse.lobelova@orkla.cz
Item
no
Description
Material No
Ordered
quantity
Unit \tPrice \tNet
Amount
Delivery
date`;

const PAGE2_HEADER = `Page 2 / 2
Purchase Order {ORDER}
Orkla Foods Česko a
Slovensko, a.s.
Postal Address
Mělnická 133
CZ-277 32 Byšice
Visitor Address (HQ)
Mělnická 133
CZ-277 32 Byšice
Phone : \tOrg. no.:
VAT reg. no.
CZ14803691`;

const FOOTER = `Best regards,
Miluše Löbelová
Orkla Foods Česko
miluse.lobelova@orkla.cz
Our purchase order numbers (unless otherwise agreed), references and if any special labelling is requested, must be quoted
on your order confirmations, packing lists and invoices.`;

function header(order: string, date: string): string {
  return HEADER.replaceAll("{ORDER}", order).replaceAll("{DATE}", date);
}

describe("parseOrklaOrderText", () => {
  it("parsuje objednávku 4500210134 (Your Material No za položkou)", () => {
    const text = `${header("4500210134", "25.03.2026")}
00010 \tBottle Lab Zveřin Buj Tek Toro Fs Nd
219010549
4.000 \tPCS \t1.975,00
Per 1000 PCS
7.900,00 \t15.04.2026
Your Material No: 322081
00020 \tBottle Lab Rybí Buj Tek Toro Fs Nd
219010550
3.000 \tPCS \t1.975,00
Per 1000 PCS
5.925,00 \t15.04.2026
Your Material No: 322082
opakovaný tisk ve všech případech
požadovaný termín dodání do Byšic: 15.-16. dubna 2026
${PAGE2_HEADER.replaceAll("{ORDER}", "4500210134")}
Item
no
Description
Material No
Ordered
quantity
Unit \tPrice \tNet
Amount
Delivery
date
svazek naštítkovat, a tento štítek poškodí etikety
Děkujeme.
Total Amount \t23.700,00
${FOOTER}`;

    const result = parseOrklaOrderText(text);
    expect(result.orderNumber).toBe("4500210134");
    expect(result.orderDate).toBe("2026-03-25");
    expect(result.currency).toBe("CZK");
    expect(result.totalAmount).toBe(23700);
    expect(result.items).toHaveLength(2);

    const [i1, i2] = result.items;
    expect(i1.itemNo).toBe("00010");
    expect(i1.description).toBe("Bottle Lab Zveřin Buj Tek Toro Fs Nd");
    expect(i1.customerMaterialNo).toBe("219010549");
    expect(i1.yourMaterialNo).toBe("322081");
    expect(i1.quantity).toBe(4000);
    expect(i1.price).toBe(1975);
    expect(i1.priceBasis).toBe(1000);
    expect(i1.netAmount).toBe(7900);
    expect(i1.deliveryDate).toBe("2026-04-15");

    expect(i2.customerMaterialNo).toBe("219010550");
    expect(i2.yourMaterialNo).toBe("322082");
    expect(i2.quantity).toBe(3000);

    expect(result.notes).toContain("opakovaný tisk ve všech případech");
    expect(result.notes).toContain("svazek naštítkovat");
    expect(result.notes).toContain("Děkujeme.");
    expect(result.notes).not.toContain("Best regards");
    expect(result.notes).not.toContain("Postal Address");
    expect(result.warnings).toHaveLength(0);
  });

  it("parsuje objednávku 4500210202 (popis na 2 řádcích, položka bez Your Material No)", () => {
    const text = `${header("4500210202", "25.03.2026")}
00010 \tBot Lab Wok Omáčka Med A Zázv Nd
219011617
10.000 \tPCS \t415,00
Per 1000 PCS
4.150,00 \t15.04.2026
Your Material No: 320122
tisk dle prefixu 21A320122 - velikost 280x85 mm
00020 \tBottle Label Aro Sójová Omáčka
1L_ND
219013132
10.000 \tPCS \t415,00
Per 1000 PCS
4.150,00 \t15.04.2026
tisk podle prefixu 25G219013132 - velikost 280x85 mm
00030 \tBottle Lab Sojová Om.
Ferment.FS_ND2
219012907
5.000 \tPCS \t415,00
Per 1000 PCS
2.075,00 \t15.04.2026
Tisk dle prefixu 25F219012907 - první tisk velikost 280x85 mm
požadovaný termín dodání do Byšic: 15.-16. dubna 2026 urgentní dodávka
Total Amount \t10.375,00
${FOOTER}`;

    const result = parseOrklaOrderText(text);
    expect(result.orderNumber).toBe("4500210202");
    expect(result.totalAmount).toBe(10375);
    expect(result.items).toHaveLength(3);

    const [i1, i2, i3] = result.items;
    expect(i1.yourMaterialNo).toBe("320122");
    expect(i1.quantity).toBe(10000);
    expect(i1.price).toBe(415);
    expect(i1.netAmount).toBe(4150);

    expect(i2.description).toBe("Bottle Label Aro Sójová Omáčka 1L_ND");
    expect(i2.customerMaterialNo).toBe("219013132");
    expect(i2.yourMaterialNo).toBeNull();

    expect(i3.description).toBe("Bottle Lab Sojová Om. Ferment.FS_ND2");
    expect(i3.customerMaterialNo).toBe("219012907");
    expect(i3.quantity).toBe(5000);
    expect(i3.netAmount).toBe(2075);

    expect(result.notes).toContain("tisk dle prefixu 21A320122");
    expect(result.notes).toContain("urgentní dodávka");
    expect(result.warnings).toHaveLength(0);
  });

  it("parsuje objednávku 4500204907 (obrácené pořadí Your Material No a Total Amount)", () => {
    const text = `${header("4500204907", "12.02.2026")}
00010 \tBottle Lab Zveřin Buj Tek Toro Fs Nd
219010549
3.000 \tPCS \t1.975,00
Per 1000 PCS
5.925,00 \t03.03.2026
322081\tYour Material No:
00020 \tBottle Lab Hovězí Buj Tek Toro Fs Nd
219009764
5.000 \tPCS \t1.975,00
Per 1000 PCS
9.875,00 \t03.03.2026
322080\tYour Material No:
${PAGE2_HEADER.replaceAll("{ORDER}", "4500204907")}
Item
no
Description
Material No
Ordered
quantity
Unit \tPrice \tNet
Amount
Delivery
date
opakovaný tisk ve všech případech
Děkujeme.
35.550,00\tTotal Amount
${FOOTER}`;

    const result = parseOrklaOrderText(text);
    expect(result.orderNumber).toBe("4500204907");
    expect(result.orderDate).toBe("2026-02-12");
    expect(result.totalAmount).toBe(35550);
    expect(result.items).toHaveLength(2);

    expect(result.items[0].yourMaterialNo).toBe("322081");
    expect(result.items[0].deliveryDate).toBe("2026-03-03");
    expect(result.items[1].yourMaterialNo).toBe("322080");
    expect(result.items[1].quantity).toBe(5000);
    expect(result.warnings).toHaveLength(0);
  });

  it("hlásí varování při nekompletních datech", () => {
    const result = parseOrklaOrderText("nějaký nesouvisející text");
    expect(result.orderNumber).toBe("");
    expect(result.items).toHaveLength(0);
    expect(result.warnings.length).toBeGreaterThan(0);
  });
});
