import { describe, expect, it } from "vitest";
import { sanitizeFilename } from "@/lib/iml-product-import-files";
import {
  buildImlProductPdfFilename,
  preferStoredPdfDownloadName,
} from "@/lib/iml-product-pdf-filename";

describe("sanitizeFilename", () => {
  it("zachová diakritiku a mezery", () => {
    expect(
      sanitizeFilename("02-01-506_VARMUZA_RYBÍ salat-150g_etiketa-1026-ak3.pdf")
    ).toBe("02-01-506_VARMUZA_RYBÍ salat-150g_etiketa-1026-ak3.pdf");
  });

  it("zachová _SOFTPROOF_ prefix", () => {
    expect(
      sanitizeFilename(
        "_SOFTPROOF_02-01-506_VARMUZA_RYBÍ salat-150g_etiketa-1026-ak3.pdf"
      )
    ).toContain("_SOFTPROOF_");
    expect(
      sanitizeFilename(
        "_SOFTPROOF_02-01-506_VARMUZA_RYBÍ salat-150g_etiketa-1026-ak3.pdf"
      )
    ).toContain("RYBÍ");
  });

  it("odstraní cestu", () => {
    expect(sanitizeFilename("C:\\uploads\\soubor.pdf")).toBe("soubor.pdf");
    expect(sanitizeFilename("/tmp/foo/bar.pdf")).toBe("bar.pdf");
  });
});

describe("preferStoredPdfDownloadName", () => {
  const product = {
    id: 42,
    ig_code: "02-01-506",
    client_name: "VARMUZA",
    product_kind: "iml",
  };

  it("použije uložený název", () => {
    expect(
      preferStoredPdfDownloadName(
        "02-01-506_VARMUZA_RYBÍ salat-150g_etiketa-1026-ak3.pdf",
        product
      )
    ).toBe("02-01-506_VARMUZA_RYBÍ salat-150g_etiketa-1026-ak3.pdf");
  });

  it("fallback pro legacy placeholder", () => {
    const generated = preferStoredPdfDownloadName("tiskova-data.pdf", product);
    expect(generated).toBe(buildImlProductPdfFilename(product));
    expect(generated.toLowerCase()).not.toBe("tiskova-data.pdf");
  });
});
