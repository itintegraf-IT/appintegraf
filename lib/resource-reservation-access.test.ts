import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: {},
}));

vi.mock("@/lib/auth-utils", () => ({
  isAdmin: vi.fn(),
  getUserRoles: vi.fn(),
  hasModuleAccess: vi.fn(),
}));

import { isAdmin, hasModuleAccess } from "@/lib/auth-utils";
import {
  canApproveVehicleReservation,
  canDeleteReservation,
  canViewReservation,
} from "./resource-reservation-access";

const admin = vi.mocked(isAdmin);
const moduleAccess = vi.mocked(hasModuleAccess);

beforeEach(() => {
  vi.clearAllMocks();
  admin.mockResolvedValue(false);
  moduleAccess.mockResolvedValue(false);
});

describe("canViewReservation", () => {
  it("tvůrce vidí vlastní rezervaci", async () => {
    await expect(
      canViewReservation(1, { created_by: 1, assigned_approver_id: 2 })
    ).resolves.toBe(true);
  });

  it("přiřazený schvalovatel vidí pending", async () => {
    await expect(
      canViewReservation(5, { created_by: 1, assigned_approver_id: 5 })
    ).resolves.toBe(true);
  });

  it("uživatel s calendar read vidí cizí rezervaci", async () => {
    moduleAccess.mockResolvedValue(true);
    await expect(
      canViewReservation(9, { created_by: 1, assigned_approver_id: 2 })
    ).resolves.toBe(true);
  });

  it("bez calendar read nevidí cizí rezervaci", async () => {
    await expect(
      canViewReservation(9, { created_by: 1, assigned_approver_id: 2 })
    ).resolves.toBe(false);
  });
});

describe("canDeleteReservation", () => {
  it("tvůrce může smazat", async () => {
    await expect(
      canDeleteReservation(1, {
        created_by: 1,
        approval_status: "approved",
        assigned_approver_id: null,
      })
    ).resolves.toBe(true);
  });

  it("schvalovatel nesmaže cizí schválenou rezervaci", async () => {
    const { getUserRoles } = await import("@/lib/auth-utils");
    vi.mocked(getUserRoles).mockResolvedValue([{ name: "sprava_vozidel", module_access: null }]);

    await expect(
      canDeleteReservation(5, {
        created_by: 1,
        approval_status: "approved",
        assigned_approver_id: 5,
      })
    ).resolves.toBe(false);
  });
});

describe("canApproveVehicleReservation", () => {
  it("bez role správa vozidel neschvaluje", async () => {
    const { getUserRoles } = await import("@/lib/auth-utils");
    vi.mocked(getUserRoles).mockResolvedValue([{ name: "viewer", module_access: null }]);

    await expect(
      canApproveVehicleReservation(5, {
        approval_status: "pending",
        assigned_approver_id: 5,
      })
    ).resolves.toBe(false);
  });
});
