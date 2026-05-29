import { describe, it, expect } from "vitest";
import {
  BACKUP_MODULES,
  getModuleWarnings,
  getTablesForDelete,
  getTablesForModules,
  normalizeModuleIds,
} from "@/lib/backup/module-registry";

describe("module-registry", () => {
  it("obsahuje všechny moduly", () => {
    expect(Object.keys(BACKUP_MODULES).sort()).toEqual(
      [
        "audit",
        "calendar",
        "contacts",
        "contracts",
        "equipment",
        "iml",
        "kiosk",
        "materialy",
        "personalistika",
        "planovani",
        "system",
        "training",
        "ukoly",
        "vyroba",
      ].sort()
    );
  });

  it("normalizuje moduly", () => {
    expect(normalizeModuleIds(["iml", "invalid", "system"])).toEqual(["iml", "system"]);
  });

  it("varování při chybějící závislosti", () => {
    const w = getModuleWarnings(["contracts"]);
    expect(w.some((x) => x.includes("Systém"))).toBe(true);
  });

  it("delete pořadí je opačné než import", () => {
    const mods = ["system", "contracts"] as const;
    const imp = getTablesForModules([...mods]).map((t) => t.name);
    const del = getTablesForDelete([...mods]).map((t) => t.name);
    expect(del).toEqual([...imp].reverse());
  });

  it("system začíná rolemi a departments", () => {
    const tables = getTablesForModules(["system"]).map((t) => t.name);
    expect(tables[0]).toBe("roles");
    expect(tables[1]).toBe("departments");
  });

  it("iml obsahuje blob tabulky", () => {
    const products = getTablesForModules(["iml"]).find((t) => t.name === "iml_products");
    expect(products?.blobColumns).toContain("image_data");
    expect(products?.blobColumns).toContain("pdf_data");
  });

  it("katalog materiálů nesahá na tabulku users", () => {
    const del = getTablesForDelete(["materialy"]).map((t) => t.name);
    const imp = getTablesForModules(["materialy"]).map((t) => t.name);
    expect(del).not.toContain("users");
    expect(imp).not.toContain("users");
  });
});
