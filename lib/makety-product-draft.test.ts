import { describe, expect, it } from "vitest";
import { buildMaketyProductDraft } from "@/lib/makety-product-draft";
import { pickLatestMaketyFileByKind } from "@/lib/makety-transfer-product-files";

describe("buildMaketyProductDraft client_name", () => {
  it("product_name má prioritu před názvem klienta", () => {
    const draft = buildMaketyProductDraft({
      customer_id: 1,
      product_id: null,
      die_cut_id: null,
      label_code: "045-01-048",
      product_name: "Piknik vejce duo pikant",
      body: "Popis zakázky",
      customer_name: "PS EUROPLAST",
    });
    expect(draft.client_name).toBe("Piknik vejce duo pikant");
  });

  it("bez product_name fallback na product.client_name", () => {
    const draft = buildMaketyProductDraft({
      customer_id: 1,
      product_id: 10,
      die_cut_id: null,
      label_code: "045-01-048",
      body: "Popis",
      customer_name: "PS EUROPLAST",
      product: {
        ig_code: "045-01-048",
        client_code: null,
        ig_short_name: "Krátký",
        client_name: "Název z katalogu",
      },
    });
    expect(draft.client_name).toBe("Název z katalogu");
  });

  it("bez product_name a produktu fallback na customer_name", () => {
    const draft = buildMaketyProductDraft({
      customer_id: 1,
      product_id: null,
      die_cut_id: null,
      label_code: "045-01-048",
      body: "Popis",
      customer_name: "PS EUROPLAST",
    });
    expect(draft.client_name).toBe("PS EUROPLAST");
  });

  it("item_status je aktivní (malá písmena)", () => {
    const draft = buildMaketyProductDraft({
      customer_id: 1,
      product_id: null,
      die_cut_id: null,
      label_code: "X",
      body: "",
    });
    expect(draft.item_status).toBe("aktivní");
  });
});

describe("pickLatestMaketyFileByKind", () => {
  const base = {
    file_path: "/uploads/makety/a.pdf",
    original_filename: "a.pdf",
  };

  it("vrátí nejnovější softproof", () => {
    const files = [
      {
        ...base,
        id: 1,
        document_type: "softproof",
        created_at: new Date("2026-01-01"),
      },
      {
        ...base,
        id: 2,
        document_type: "softproof",
        created_at: new Date("2026-02-01"),
      },
      {
        ...base,
        id: 3,
        document_type: "print_data",
        created_at: new Date("2026-03-01"),
      },
    ];
    const latest = pickLatestMaketyFileByKind(files, "softproof");
    expect(latest?.id).toBe(2);
  });

  it("vrátí null když typ chybí", () => {
    const files = [
      {
        ...base,
        id: 1,
        document_type: "print_data",
        created_at: new Date("2026-01-01"),
      },
    ];
    expect(pickLatestMaketyFileByKind(files, "softproof")).toBeNull();
  });
});
