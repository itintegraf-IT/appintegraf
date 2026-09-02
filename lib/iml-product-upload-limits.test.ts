import { describe, expect, it } from "vitest";
import {
  MAX_PRODUCT_PDF_BYTES,
  validateProductPdfSize,
} from "@/lib/iml-product-upload-limits";

describe("validateProductPdfSize", () => {
  it("povolí PDF do 100 MB včetně (70 MB OK)", () => {
    const seventyMb = 70 * 1024 * 1024;
    expect(() => validateProductPdfSize(seventyMb)).not.toThrow();
    expect(() => validateProductPdfSize(MAX_PRODUCT_PDF_BYTES)).not.toThrow();
  });

  it("zamítne PDF nad 100 MB (101 MB ne)", () => {
    const oneHundredOneMb = 101 * 1024 * 1024;
    expect(() => validateProductPdfSize(oneHundredOneMb)).toThrow(
      /PDF je příliš velké \(max 100 MB\)/
    );
  });
});
