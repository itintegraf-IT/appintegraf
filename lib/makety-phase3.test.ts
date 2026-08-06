import { describe, expect, it } from "vitest";
import { buildMaketyCiceroXml, ciceroExportFileName } from "@/lib/makety-cicero-xml";
import { buildMaketyProductDraft } from "@/lib/makety-product-draft";

describe("makety-cicero-xml", () => {
  it("sestaví validní XML s escapováním", () => {
    const xml = buildMaketyCiceroXml({
      maketaId: 12,
      jobNumber: "J-1&2",
      orderNumber: null,
      labelCode: "L<1>",
      status: "approved",
      body: "Poznámka \"test\"",
      dueAt: new Date("2026-08-01T10:00:00.000Z"),
      customerName: "Firma & Co",
      customerEmail: "a@b.cz",
      productIgCode: "IG1",
      dieCutCode: "DC1",
      assigneeName: "Jan Novák",
      prepressName: null,
      finalApproverName: "Eva",
      fileNames: ["soft.pdf"],
    });
    expect(xml).toContain("<InternalId>12</InternalId>");
    expect(xml).toContain("J-1&amp;2");
    expect(xml).toContain("L&lt;1&gt;");
    expect(xml).toContain("Firma &amp; Co");
    expect(xml).toContain("<File>soft.pdf</File>");
  });

  it("pojmenuje soubor bezpečně", () => {
    expect(
      ciceroExportFileName({
        maketaId: 5,
        jobNumber: "ab/cd",
        orderNumber: null,
        labelCode: null,
        status: "open",
        body: "",
        dueAt: new Date(),
        customerName: null,
        customerEmail: null,
        productIgCode: null,
        dieCutCode: null,
        assigneeName: null,
        prepressName: null,
        finalApproverName: null,
        fileNames: [],
      })
    ).toBe("grafika_ab_cd_5.xml");
  });
});

describe("makety-product-draft", () => {
  it("navrhne create bez produktu", () => {
    const d = buildMaketyProductDraft({
      customer_id: 3,
      product_id: null,
      die_cut_id: 9,
      label_code: "498056",
      body: "text",
      product: null,
    });
    expect(d.mode).toBe("create");
    expect(d.ig_code).toBe("498056");
    expect(d.missing_fields).toEqual([]);
  });

  it("navrhne update a hlásí chybějící klient", () => {
    const d = buildMaketyProductDraft({
      customer_id: null,
      product_id: 44,
      die_cut_id: null,
      label_code: null,
      body: "",
      product: { ig_code: "X", client_code: "C", ig_short_name: "N" },
    });
    expect(d.mode).toBe("update");
    expect(d.product_id).toBe(44);
    expect(d.missing_fields).toContain("customer_id");
  });
});
