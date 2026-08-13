import { describe, expect, it } from "vitest";
import {
  maketyFileKindLabel,
  parseMaketyFileKind,
  requireMaketyFileKind,
} from "@/lib/makety-file-kind";

describe("makety-file-kind", () => {
  it("parsuje platné typy", () => {
    expect(parseMaketyFileKind("softproof")).toBe("softproof");
    expect(parseMaketyFileKind("PRINT_DATA")).toBe("print_data");
    expect(parseMaketyFileKind("other")).toBe("other");
  });

  it("odmítne neplatné", () => {
    expect(parseMaketyFileKind("")).toBeNull();
    expect(parseMaketyFileKind("pdf")).toBeNull();
    expect(requireMaketyFileKind(null).ok).toBe(false);
  });

  it("labely", () => {
    expect(maketyFileKindLabel("softproof")).toContain("Softproof");
    expect(maketyFileKindLabel("print_data")).toBe("Tisková data");
  });
});
