import { describe, it, expect } from "vitest";
import { pathWithError, decodeNavError, NAV_ERRORS } from "@/lib/navigation-errors";

describe("navigation-errors", () => {
  it("encodes diacritics for Location header safety", () => {
    const url = pathWithError("/contacts", "NO_PERMISSION");
    expect(url).not.toContain("á");
    expect(url).toContain("error=");
    expect(decodeNavError(new URL(url, "http://x").searchParams.get("error"))).toBe(
      NAV_ERRORS.NO_PERMISSION
    );
  });
});
