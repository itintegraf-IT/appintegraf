import { describe, expect, it } from "vitest";
import {
  isAllowedDieCutCadFile,
  mimeForDieCutCadFile,
} from "@/lib/iml-die-cut-upload-constants";

describe("iml-die-cut-upload-constants", () => {
  it("povolí PDF / DXF / DWG", () => {
    expect(isAllowedDieCutCadFile("vysek.pdf", "application/pdf")).toBe(true);
    expect(isAllowedDieCutCadFile("layout.DXF", "application/octet-stream")).toBe(true);
    expect(isAllowedDieCutCadFile("tool.dwg", "")).toBe(true);
  });

  it("odmítne jiné přípony", () => {
    expect(isAllowedDieCutCadFile("foto.jpg", "image/jpeg")).toBe(false);
    expect(isAllowedDieCutCadFile("data.zip", "application/zip")).toBe(false);
    expect(isAllowedDieCutCadFile("bezpripony", "application/pdf")).toBe(false);
  });

  it("doplní MIME podle přípony", () => {
    expect(mimeForDieCutCadFile("a.pdf", "application/octet-stream")).toBe("application/pdf");
    expect(mimeForDieCutCadFile("a.dxf", "")).toBe("application/dxf");
    expect(mimeForDieCutCadFile("a.dwg", null)).toBe("application/dwg");
  });
});
