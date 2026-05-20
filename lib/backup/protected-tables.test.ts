import { describe, it, expect } from "vitest";
import {
  BACKUP_PRISMA_MODELS_REQUIRE_SYSTEM,
  isBackupTableProtectedWithoutSystem,
} from "@/lib/backup/protected-tables";

describe("protected-tables", () => {
  it("users a roles jsou chráněné bez modulu system", () => {
    expect(isBackupTableProtectedWithoutSystem("users")).toBe(true);
    expect(isBackupTableProtectedWithoutSystem("roles")).toBe(true);
  });

  it("běžné modulové tabulky nejsou v seznamu", () => {
    expect(isBackupTableProtectedWithoutSystem("materials")).toBe(false);
    expect(isBackupTableProtectedWithoutSystem("iml_products")).toBe(false);
  });

  it("množina je konzistentní s očekávanými názvy modelů", () => {
    expect(BACKUP_PRISMA_MODELS_REQUIRE_SYSTEM.has("users")).toBe(true);
    expect(BACKUP_PRISMA_MODELS_REQUIRE_SYSTEM.has("system_settings")).toBe(true);
  });
});
