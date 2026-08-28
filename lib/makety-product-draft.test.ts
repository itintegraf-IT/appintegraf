import { describe, expect, it } from "vitest";
import {
  buildMaketyProductDraft,
  requiresIgCodeReplaceConfirmation,
  supplementProductFromDraft,
} from "@/lib/makety-product-draft";
import { matchProductByIgCode } from "@/lib/makety-iml-product-lookup";
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

describe("supplementProductFromDraft", () => {
  const draft = buildMaketyProductDraft({
    customer_id: 2,
    product_id: null,
    die_cut_id: 5,
    label_code: "045-01-048",
    product_name: "Nový název",
    body: "Nová poznámka",
  });

  it("doplní prázdná pole, vyplněná nepřepíše", () => {
    const update = supplementProductFromDraft(
      {
        client_code: "EXIST",
        client_name: "Původní název",
        ig_short_name: null,
        production_notes: "",
        die_cut_id: null,
        customer_id: null,
      },
      draft
    );
    expect(update.client_code).toBeUndefined();
    expect(update.client_name).toBeUndefined();
    expect(update.ig_short_name).toBe(draft.ig_short_name);
    expect(update.production_notes).toBe(draft.production_notes);
    expect(update.iml_die_cuts).toEqual({ connect: { id: 5 } });
    expect(update.iml_customers).toEqual({ connect: { id: 2 } });
  });
});

describe("requiresIgCodeReplaceConfirmation", () => {
  const conflict = {
    product_id: 42,
    ig_code: "045-01-048",
    client_name: "Test",
    ig_short_name: null,
    customer_id: 1,
  };

  it("create + konflikt bez confirm vyžaduje potvrzení", () => {
    expect(
      requiresIgCodeReplaceConfirmation({
        draftMode: "create",
        draftProductId: null,
        conflict,
        confirmReplace: false,
      })
    ).toBe(true);
  });

  it("create + confirmReplace projde", () => {
    expect(
      requiresIgCodeReplaceConfirmation({
        draftMode: "create",
        draftProductId: null,
        conflict,
        confirmReplace: true,
      })
    ).toBe(false);
  });

  it("update stejného produktu nevyžaduje replace confirm", () => {
    expect(
      requiresIgCodeReplaceConfirmation({
        draftMode: "update",
        draftProductId: 42,
        conflict,
        confirmReplace: false,
      })
    ).toBe(false);
  });
});

describe("matchProductByIgCode", () => {
  it("porovná kódy case-insensitively", () => {
    expect(matchProductByIgCode("045-01-048", "045-01-048")).toBe(true);
    expect(matchProductByIgCode("045-01-048", " 045-01-048 ")).toBe(true);
    expect(matchProductByIgCode("045-01-048", "045-01-047")).toBe(false);
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
