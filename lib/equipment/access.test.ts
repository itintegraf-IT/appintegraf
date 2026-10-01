import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: { equipment_categories: { findMany: vi.fn() } },
}));
vi.mock("@/lib/auth-utils", () => ({
  isAdmin: vi.fn(),
  getUserRoles: vi.fn(),
  hasModuleAccess: vi.fn(),
}));

import { hasModuleAccess, isAdmin } from "@/lib/auth-utils";
import { prisma } from "@/lib/db";
import { canAdministerEquipment, canManageRegister, getWritableCategoryIds } from "./access";

type Level = "read" | "write" | "admin";
const RANK: Record<Level, number> = { read: 1, write: 2, admin: 3 };

/** Úroveň přístupu k modulu Majetek pro testovaného uživatele (jako module_access v user_roles). */
function givenUser(opts: { globalAdmin?: boolean; equipment?: Level }) {
  vi.mocked(isAdmin).mockResolvedValue(opts.globalAdmin ?? false);
  vi.mocked(hasModuleAccess).mockImplementation(async (_userId, module, access = "read") => {
    if (opts.globalAdmin) return true;
    if (module !== "equipment" || !opts.equipment) return false;
    return RANK[opts.equipment] >= RANK[access as Level];
  });
}

beforeEach(() => vi.clearAllMocks());

describe("role v modulu Majetek", () => {
  it("Editor (write) spravuje evidenci, ale není správce modulu", async () => {
    givenUser({ equipment: "write" });
    await expect(canManageRegister(1)).resolves.toBe(true);
    await expect(canAdministerEquipment(1)).resolves.toBe(false);
  });

  it("Čtenář (read) evidenci nespravuje", async () => {
    givenUser({ equipment: "read" });
    await expect(canManageRegister(1)).resolves.toBe(false);
    await expect(canAdministerEquipment(1)).resolves.toBe(false);
  });

  it("Admin modulu i globální admin smí obojí", async () => {
    givenUser({ equipment: "admin" });
    await expect(canManageRegister(1)).resolves.toBe(true);
    await expect(canAdministerEquipment(1)).resolves.toBe(true);
    givenUser({ globalAdmin: true });
    await expect(canManageRegister(1)).resolves.toBe(true);
    await expect(canAdministerEquipment(1)).resolves.toBe(true);
  });

  it("bez přístupu k Majetku nic", async () => {
    givenUser({});
    await expect(canManageRegister(1)).resolves.toBe(false);
  });
});

describe("getWritableCategoryIds", () => {
  it("Editor smí zapisovat do všech skupin (null = bez omezení)", async () => {
    givenUser({ equipment: "write" });
    await expect(getWritableCategoryIds(1)).resolves.toBeNull();
  });

  it("zodpovědný za skupinu bez úrovně Editor smí jen do svých skupin", async () => {
    givenUser({ equipment: "read" });
    vi.mocked(prisma.equipment_categories.findMany).mockResolvedValue([{ id: 7 }, { id: 9 }] as never);
    await expect(getWritableCategoryIds(1)).resolves.toEqual([7, 9]);
  });
});
