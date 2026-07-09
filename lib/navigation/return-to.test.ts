import { describe, expect, it } from "vitest";
import {
  isSafeInternalPath,
  preserveReturnTo,
  resolveBackHref,
  withReturnTo,
} from "@/lib/navigation/return-to";

describe("return-to navigation", () => {
  it("withReturnTo přidá encoded returnTo", () => {
    const href = withReturnTo("/iml/products/1", "/iml/products?customer_id=5");
    expect(href).toContain("returnTo=");
    expect(decodeURIComponent(href)).toContain("/iml/products?customer_id=5");
  });

  it("resolveBackHref vrátí returnTo nebo fallback", () => {
    expect(resolveBackHref(null, "/iml/products")).toBe("/iml/products");
    expect(
      resolveBackHref(encodeURIComponent("/iml/products?customer_id=5"), "/iml/products")
    ).toBe("/iml/products?customer_id=5");
    expect(resolveBackHref("https://evil.com", "/iml/products")).toBe("/iml/products");
  });

  it("isSafeInternalPath odmítne externí URL", () => {
    expect(isSafeInternalPath("/iml/products")).toBe(true);
    expect(isSafeInternalPath("//evil.com")).toBe(false);
    expect(isSafeInternalPath("https://evil.com")).toBe(false);
  });

  it("preserveReturnTo zachová returnTo při editaci", () => {
    const encoded = encodeURIComponent("/iml/products?customer_id=5");
    const href = preserveReturnTo("/iml/products/1/edit", encoded);
    expect(decodeURIComponent(href)).toContain("customer_id=5");
  });
});
