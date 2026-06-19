import { describe, expect, it } from "vitest";
import {
  isStitkyModuleEnabled,
  normalizeStitkyModuleAccessForSave,
  roleStitkyGrantsModuleAccess,
  stitkyRolesFromAccessRecord,
} from "@/lib/stitky-module-access-flags";

describe("stitky-module-access-flags", () => {
  it("tiskař bez zadavatele má read přístup", () => {
    const ma = { stitky: "read", stitky_tiskar: "1" };
    expect(isStitkyModuleEnabled(ma)).toBe(true);
    expect(roleStitkyGrantsModuleAccess(ma, "read")).toBe(true);
    expect(roleStitkyGrantsModuleAccess(ma, "write")).toBe(false);
    expect(stitkyRolesFromAccessRecord(ma)).toEqual(["TISKAR"]);
  });

  it("zadavatel write + mistr", () => {
    const ma = { stitky: "write", stitky_mistr: "1" };
    expect(stitkyRolesFromAccessRecord(ma)).toEqual(["ZADAVATEL", "MISTER"]);
  });

  it("normalize doplní read při samotném tiskaři", () => {
    const out = normalizeStitkyModuleAccessForSave({ stitky_tiskar: "1" });
    expect(out).toEqual({ stitky: "read", stitky_tiskar: "1" });
  });
});
