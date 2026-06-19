import { describe, expect, it } from "vitest";
import { hasStitkyTiskarFlag } from "@/lib/stitky-module-access-flags";

describe("stitky recipients flags", () => {
  it("rozpozná tiskaře z module_access", () => {
    expect(hasStitkyTiskarFlag({ stitky: "read", stitky_tiskar: "1" })).toBe(true);
    expect(hasStitkyTiskarFlag({ stitky: "write" })).toBe(false);
  });
});
