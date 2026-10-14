import { describe, expect, it } from "vitest";
import {
  resolveMaketaProductNotifyDetails,
  type MaketaProductNotifySource,
} from "@/lib/makety-notify-product";

function source(
  partial: Partial<MaketaProductNotifySource> & {
    iml_products?: MaketaProductNotifySource["iml_products"];
  }
): MaketaProductNotifySource {
  return {
    product_id: partial.product_id ?? null,
    label_code: partial.label_code ?? null,
    product_name: partial.product_name ?? null,
    job_number: partial.job_number ?? null,
    iml_products: partial.iml_products ?? null,
  };
}

const catalogProduct = {
  id: 10,
  ig_code: "OLD-IG-001",
  client_name: "Starý název z katalogu",
  ig_short_name: "Starý short",
};

describe("resolveMaketaProductNotifyDetails", () => {
  it("preferuje label_code a product_name z makety před IML katalogem", () => {
    const result = resolveMaketaProductNotifyDetails(
      source({
        product_id: 10,
        label_code: "NOVY-KOD",
        product_name: "Nový název kopie",
        job_number: "J-99",
        iml_products: catalogProduct,
      })
    );

    expect(result).toEqual({
      labelCode: "NOVY-KOD",
      productName: "Nový název kopie",
      productId: 10,
      jobNumber: "J-99",
    });
  });

  it("doplní chybějící pole z katalogu", () => {
    const result = resolveMaketaProductNotifyDetails(
      source({
        product_id: 10,
        label_code: null,
        product_name: null,
        job_number: null,
        iml_products: catalogProduct,
      })
    );

    expect(result.labelCode).toBe("OLD-IG-001");
    expect(result.productName).toBe("Starý název z katalogu");
    expect(result.productId).toBe(10);
    expect(result.jobNumber).toBeNull();
  });

  it("ignoruje prázdné řetězce a bere katalog", () => {
    const result = resolveMaketaProductNotifyDetails(
      source({
        product_id: 10,
        label_code: "   ",
        product_name: "",
        iml_products: catalogProduct,
      })
    );

    expect(result.labelCode).toBe("OLD-IG-001");
    expect(result.productName).toBe("Starý název z katalogu");
  });
});
