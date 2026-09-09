import { describe, expect, it } from "vitest";
import {
  hasMaketyProhlizecKlientaFlag,
  normalizeMaketyModuleAccessForSave,
  roleHasMaketyProhlizecKlientaFromDecoded,
  roleMaketyGrantsModuleAccess,
} from "@/lib/makety-module-access-flags";

describe("makety_prohlizec_klienta flag", () => {
  it("rozpozná příznak v module_access", () => {
    expect(hasMaketyProhlizecKlientaFlag({ makety_prohlizec_klienta: "1" })).toBe(true);
    expect(hasMaketyProhlizecKlientaFlag({})).toBe(false);
  });

  it("normalize zachová prohlížeče a doplní base read", () => {
    const next = normalizeMaketyModuleAccessForSave({
      makety_prohlizec_klienta: "1",
    });
    expect(next.makety).toBe("read");
    expect(next.makety_prohlizec_klienta).toBe("1");
  });

  it("roleMaketyGrantsModuleAccess read pro prohlížeče", () => {
    expect(
      roleMaketyGrantsModuleAccess({ makety_prohlizec_klienta: "1" }, "read")
    ).toBe(true);
    expect(
      roleMaketyGrantsModuleAccess({ makety_prohlizec_klienta: "1" }, "write")
    ).toBe(false);
    expect(roleHasMaketyProhlizecKlientaFromDecoded({ makety_prohlizec_klienta: true })).toBe(
      true
    );
  });
});
