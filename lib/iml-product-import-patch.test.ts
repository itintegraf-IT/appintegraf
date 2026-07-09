import { describe, expect, it } from "vitest";
import {
  autoMapHeaders,
  normalizeHeaderKey,
  normalizeProductCode,
  type ColumnMapping,
} from "@/lib/iml-product-import-parse";
import { buildProductPatchPayload } from "@/lib/iml-product-import-patch";

describe("normalizeHeaderKey", () => {
  it("odstraní diakritiku a sjednotí mezery", () => {
    expect(normalizeHeaderKey("  Nástroj   číslo ")).toBe("nastroj cislo");
    expect(normalizeHeaderKey("Kód")).toBe("kod");
    expect(normalizeHeaderKey("Zákazník")).toBe("zakaznik");
  });
});

describe("autoMapHeaders – české hlavičky Jepa", () => {
  it("mapuje sloupce z Jepa+vysek.xlsx", () => {
    const headers = ["Kód", "Produkt", "Název", "Zákazník", "Nástroj číslo"];
    const mapping = autoMapHeaders(headers);
    expect(mapping.ig_code).toBe(0);
    expect(mapping.label_shape_code).toBe(1);
    expect(mapping.client_name).toBe(2);
    expect(mapping.customer_name).toBe(3);
    expect(mapping.die_cut_tool_code).toBe(4);
  });
});

describe("buildProductPatchPayload", () => {
  const customerByName = new Map<string, number>([["test zakaznik", 42]]);

  it("obsahuje jen neprázdná namapovaná pole", async () => {
    const headers = ["Kód", "Nástroj číslo", "Název"];
    const row = ["04-03-001", "0016B(249,6 x 81,3)", "Název produktu"];
    const mapping: ColumnMapping = {
      ig_code: 0,
      die_cut_tool_code: 1,
      client_name: 2,
    };

    const result = await buildProductPatchPayload(row, mapping, customerByName, headers);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.result.igCode).toBe("04-03-001");
    expect(result.result.patch.die_cut_tool_code).toBe("0016B(249,6 x 81,3)");
    expect(result.result.patch.client_name).toBe("Název produktu");
    expect(result.result.patch.ig_code).toBeUndefined();
  });

  it("prázdný výsek nemění die_cut_tool_code (není v patch)", async () => {
    const row = ["04-03-001", "", "Název"];
    const mapping: ColumnMapping = {
      ig_code: 0,
      die_cut_tool_code: 1,
      client_name: 2,
    };

    const result = await buildProductPatchPayload(row, mapping, customerByName);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.result.patch.die_cut_tool_code).toBeUndefined();
    expect(result.result.patch.client_name).toBe("Název");
  });

  it("normalizuje kód ig_code", async () => {
    const row = ["  04-03-001  ", "vysek"];
    const mapping: ColumnMapping = { ig_code: 0, die_cut_tool_code: 1 };

    const result = await buildProductPatchPayload(row, mapping, customerByName);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.result.igCode).toBe(normalizeProductCode("04-03-001"));
    expect(result.result.igCode).toBe("04-03-001");
  });

  it("vrátí chybu bez ig_code", async () => {
    const row = ["", "vysek"];
    const mapping: ColumnMapping = { ig_code: 0, die_cut_tool_code: 1 };

    const result = await buildProductPatchPayload(row, mapping, customerByName);
    expect(result.ok).toBe(false);
  });

  it("vrátí chybu když není co doplnit", async () => {
    const row = ["04-03-001", ""];
    const mapping: ColumnMapping = { ig_code: 0, die_cut_tool_code: 1 };

    const result = await buildProductPatchPayload(row, mapping, customerByName);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe("Žádná pole k doplnění");
  });
});
