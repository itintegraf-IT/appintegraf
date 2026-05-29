import { describe, it, expect } from "vitest";
import { resolveBackupRestoreModules } from "@/lib/backup/restore-modules";

describe("resolveBackupRestoreModules", () => {
  it("projde, když jsou všechny vybrané moduly v manifestu", () => {
    const r = resolveBackupRestoreModules(["materialy"], ["materialy", "system"]);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.effective).toEqual(["materialy"]);
  });

  it("odmítne modul, který v manifestu není", () => {
    const r = resolveBackupRestoreModules(["system", "materialy"], ["materialy"]);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error).toContain("system");
      expect(r.error).toContain("materialy");
    }
  });

  it("odmítne prázdný manifest modulů po normalizaci", () => {
    const r = resolveBackupRestoreModules(["materialy"], ["neplatny_modul" as "materialy"]);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("Manifest");
  });

  it("projde pro úplný výběr shodný s manifestem", () => {
    const r = resolveBackupRestoreModules(["materialy", "system"], ["system", "materialy"]);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.effective).toEqual(["materialy", "system"]);
  });
});
