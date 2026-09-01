import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  assetPathForProduct,
  buildExportAssetBasename,
  collectProductExportAssets,
  hasProductExportAssets,
  parseProductExportAssetOptions,
  PRODUCT_EXPORT_ASSETS_FOLDER,
} from "@/lib/iml-export-products-assets";
import {
  buildProductExportCsvWithAssetPaths,
  type ProductExportSourceRow,
} from "@/lib/iml-export-product-columns";

vi.mock("@/lib/iml-product-archive", () => ({
  resolveProductPdfBuffer: vi.fn(),
}));

import { resolveProductPdfBuffer } from "@/lib/iml-product-archive";

const mockResolvePdf = vi.mocked(resolveProductPdfBuffer);

const mockPdf = {
  buffer: Buffer.from("pdf"),
  filename: "x.pdf",
  mimeType: "application/pdf",
  version: 1 as const,
  source: "blob" as const,
  fileId: 1,
};

function minimalRow(id: number, igCode: string | null): ProductExportSourceRow {
  return { id, ig_code: igCode } as ProductExportSourceRow;
}

describe("buildExportAssetBasename", () => {
  it("použije sanitizovaný ig_code", () => {
    expect(buildExportAssetBasename("045-01-048", 1)).toBe("045-01-048");
  });

  it("fallback na produkt-{id} bez kódu", () => {
    expect(buildExportAssetBasename(null, 42)).toBe("produkt-42");
    expect(buildExportAssetBasename("  ", 7)).toBe("produkt-7");
  });

  it("nahradí nebezpečné znaky v názvu", () => {
    const base = buildExportAssetBasename('045/01\\048', 1);
    expect(base).not.toMatch(/[/\\]/);
  });
});

describe("parseProductExportAssetOptions", () => {
  it("parsuje query parametry", () => {
    expect(parseProductExportAssetOptions({ include_print: "1", include_softproof: "0" })).toEqual({
      includePrint: true,
      includeSoftproof: false,
    });
  });

  it("parsuje boolean z filtrů šablony", () => {
    expect(parseProductExportAssetOptions({ include_print: true, include_softproof: true })).toEqual({
      includePrint: true,
      includeSoftproof: true,
    });
  });
});

describe("hasProductExportAssets", () => {
  it("vrátí false bez voleb", () => {
    expect(hasProductExportAssets({ includePrint: false, includeSoftproof: false })).toBe(false);
  });

  it("vrátí true při alespoň jedné volbě", () => {
    expect(hasProductExportAssets({ includePrint: true, includeSoftproof: false })).toBe(true);
  });
});

describe("assetPathForProduct", () => {
  it("vrátí cestu nebo prázdný řetězec", () => {
    const paths = new Map([
      [1, { soubor_tisk: `${PRODUCT_EXPORT_ASSETS_FOLDER}/045-01-048-tisk.pdf` }],
    ]);
    expect(assetPathForProduct(paths, 1, "soubor_tisk")).toBe(
      `${PRODUCT_EXPORT_ASSETS_FOLDER}/045-01-048-tisk.pdf`
    );
    expect(assetPathForProduct(paths, 2, "soubor_tisk")).toBe("");
  });
});

describe("collectProductExportAssets", () => {
  beforeEach(() => {
    mockResolvePdf.mockReset();
  });

  it("pojmenuje soubory podle ig_code", async () => {
    mockResolvePdf.mockResolvedValue(mockPdf);
    const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0x00]);

    const { files, paths } = await collectProductExportAssets(
      [{ id: 1, ig_code: "045-01-048", image_data: jpeg }],
      { includePrint: true, includeSoftproof: true }
    );

    expect(files).toHaveLength(2);
    expect(files[0].zipPath).toBe(`${PRODUCT_EXPORT_ASSETS_FOLDER}/045-01-048-tisk.pdf`);
    expect(files[1].zipPath).toBe(`${PRODUCT_EXPORT_ASSETS_FOLDER}/045-01-048-softproof.jpg`);
    expect(paths.get(1)).toEqual({
      soubor_tisk: `${PRODUCT_EXPORT_ASSETS_FOLDER}/045-01-048-tisk.pdf`,
      soubor_softproof: `${PRODUCT_EXPORT_ASSETS_FOLDER}/045-01-048-softproof.jpg`,
    });
  });

  it("řeší kolizi stejného basename suffixem -v2", async () => {
    mockResolvePdf.mockResolvedValue(mockPdf);

    const { files } = await collectProductExportAssets(
      [
        { id: 1, ig_code: "045-01-048", image_data: null },
        { id: 2, ig_code: "045-01-048", image_data: null },
      ],
      { includePrint: true, includeSoftproof: false }
    );

    expect(files.map((f) => f.zipPath)).toEqual([
      `${PRODUCT_EXPORT_ASSETS_FOLDER}/045-01-048-tisk.pdf`,
      `${PRODUCT_EXPORT_ASSETS_FOLDER}/045-01-048-v2-tisk.pdf`,
    ]);
  });

  it("přeskočí chybějící PDF, řádek zůstane bez soubor_tisk", async () => {
    mockResolvePdf.mockResolvedValue(null);

    const { files, paths } = await collectProductExportAssets(
      [{ id: 3, ig_code: "999-99-999", image_data: null }],
      { includePrint: true, includeSoftproof: false }
    );

    expect(files).toHaveLength(0);
    expect(paths.has(3)).toBe(false);
  });
});

describe("buildProductExportCsvWithAssetPaths", () => {
  it("doplní sloupce soubor_tisk a soubor_softproof", () => {
    const paths = new Map([
      [
        1,
        {
          soubor_tisk: `${PRODUCT_EXPORT_ASSETS_FOLDER}/045-01-048-tisk.pdf`,
          soubor_softproof: `${PRODUCT_EXPORT_ASSETS_FOLDER}/045-01-048-softproof.jpg`,
        },
      ],
    ]);

    const csv = buildProductExportCsvWithAssetPaths(
      [minimalRow(1, "045-01-048")],
      [{ key: "ig_code" }],
      paths,
      { includePrint: true, includeSoftproof: true }
    );

    const lines = csv.split("\n");
    expect(lines[0]).toBe("Kód IG;soubor_tisk;soubor_softproof");
    expect(lines[1]).toBe(
      `045-01-048;${PRODUCT_EXPORT_ASSETS_FOLDER}/045-01-048-tisk.pdf;${PRODUCT_EXPORT_ASSETS_FOLDER}/045-01-048-softproof.jpg`
    );
  });

  it("prázdný soubor_tisk když PDF chybí", () => {
    const csv = buildProductExportCsvWithAssetPaths(
      [minimalRow(2, "111-11-111")],
      [{ key: "ig_code" }],
      new Map(),
      { includePrint: true, includeSoftproof: false }
    );

    expect(csv.split("\n")[1]).toBe("111-11-111;");
  });
});
