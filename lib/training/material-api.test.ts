import { describe, expect, it } from "vitest";
import { normalizeMediaUrl, validateMaterialPayload } from "@/lib/training/material-api";

describe("normalizeMediaUrl", () => {
  it("null vrátí null, ne řetězec null", () => {
    expect(normalizeMediaUrl(null)).toBeNull();
  });

  it("prázdný řetězec vrátí null", () => {
    expect(normalizeMediaUrl("")).toBeNull();
    expect(normalizeMediaUrl("   ")).toBeNull();
  });
});

describe("validateMaterialPayload video", () => {
  it("povolí video jen se souborem bez URL", () => {
    const result = validateMaterialPayload(
      {
        title: "Test video",
        material_type: "video",
        media_url: null,
      },
      { isCreate: true, hasFile: true }
    );
    expect(result.ok).toBe(true);
  });

  it("nepovažuje null URL za neplatnou", () => {
    const result = validateMaterialPayload(
      {
        title: "Test video",
        material_type: "video",
        media_url: null,
      },
      { isCreate: true, hasFile: true }
    );
    if (!result.ok) throw new Error(result.error);
    expect(result.data.media_url).toBeNull();
  });
});
