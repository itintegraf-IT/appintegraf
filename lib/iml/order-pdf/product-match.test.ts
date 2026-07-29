import { describe, expect, it } from "vitest";
import {
  buildProductCodeIndexes,
  matchProductByCodes,
  type ProductCodeRow,
} from "./product-match";

const orklaProduct: ProductCodeRow = {
  id: 1,
  ig_code: "219010549",
  client_code: "322081",
  client_name: "TORO zvěřinový bujon",
  ig_short_name: null,
  customer_id: 10,
};

describe("matchProductByCodes", () => {
  const indexes = buildProductCodeIndexes([orklaProduct]);

  it("najde produkt podle Orkla Material No uloženého v ig_code", () => {
    const r = matchProductByCodes(indexes, ["219010549", "322081"]);
    expect(r.product?.id).toBe(1);
    expect(r.matchedBy).toBe("ig_code");
    expect(r.matchedCode).toBe("219010549");
  });

  it("najde produkt podle Your Material No uloženého v client_code", () => {
    const indexesSwapped = buildProductCodeIndexes([
      { ...orklaProduct, ig_code: "322081", client_code: "219010549" },
    ]);
    const r = matchProductByCodes(indexesSwapped, ["219010549", "322081"]);
    expect(r.product?.id).toBe(1);
    expect(r.matchedBy).toBe("client_code");
  });

  it("najde produkt jen podle druhého kódu", () => {
    const r = matchProductByCodes(indexes, [null, "322081"]);
    expect(r.product?.id).toBe(1);
    expect(r.matchedBy).toBe("client_code");
  });

  it("vrátí null pokud žádný kód neodpovídá", () => {
    const r = matchProductByCodes(indexes, ["999999"]);
    expect(r.product).toBeNull();
  });
});
