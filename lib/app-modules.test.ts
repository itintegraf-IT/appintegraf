import { describe, expect, it } from "vitest";
import { APP_MODULE_KEYS, expandAllModuleAccess, parseStoredModuleAccess } from "./app-modules";

describe("app-modules", () => {
  it("expandAllModuleAccess obsahuje všechny moduly", () => {
    const expanded = expandAllModuleAccess("admin");
    for (const key of APP_MODULE_KEYS) {
      expect(expanded[key]).toBe("admin");
    }
    expect(Object.keys(expanded)).toHaveLength(APP_MODULE_KEYS.length);
  });

  it("parseStoredModuleAccess rozbalí { all: true }", () => {
    const result = parseStoredModuleAccess({ all: true });
    expect(result.materialy).toBe("admin");
    expect(result.makety).toBe("admin");
    expect(result.personalistika).toBe("admin");
    expect(result.contracts).toBe("admin");
  });

  it("parseStoredModuleAccess parsuje JSON string", () => {
    const result = parseStoredModuleAccess('{"all":true}');
    expect(result.ukoly).toBe("admin");
    expect(result.materialy).toBe("admin");
  });

  it("parseStoredModuleAccess vrátí per-modul přístup", () => {
    const result = parseStoredModuleAccess({ contacts: "read", makety: "write" });
    expect(result).toEqual({ contacts: "read", makety: "write" });
  });
});
