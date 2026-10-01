import { beforeEach, describe, expect, it, vi } from "vitest";

// Oddělení jako ve skutečné DB: „IT oddělení“ s kódem IT, „Vedení“ s kódem MGT.
const DEPARTMENTS = [
  { id: 23, name: "IT oddělení", code: "IT", is_active: true },
  { id: 26, name: "Vedení", code: "MGT", is_active: true },
  { id: 99, name: "Zrušené", code: "OLD", is_active: false },
];
const USERS = [
  { id: 35, department_id: 23 },
  { id: 12, department_id: 26 },
  { id: 70, department_id: 99 },
];
const SECONDARY = [{ user_id: 48, department_id: 23 }];

vi.mock("@/lib/db", () => {
  type Where = Record<string, unknown>;
  const matchDept = (where: Where) =>
    DEPARTMENTS.find(
      (d) =>
        (where.name === undefined || d.name === where.name) &&
        (where.code === undefined || d.code === where.code) &&
        // filtr aktivních: { not: false } (knihovna) i true (staré kopie v routách)
        (where.is_active === undefined || where.is_active === true ? d.is_active : d.is_active !== false)
    ) ?? null;
  return {
    prisma: {
      departments: { findFirst: vi.fn(async ({ where }: { where: Where }) => matchDept(where)) },
      users: {
        findFirst: vi.fn(async ({ where }: { where: { id: number; department_id: number } }) =>
          USERS.find((u) => u.id === where.id && u.department_id === where.department_id) ?? null
        ),
      },
      user_secondary_departments: {
        findFirst: vi.fn(async ({ where }: { where: { user_id: number; department_id: number } }) =>
          SECONDARY.find((s) => s.user_id === where.user_id && s.department_id === where.department_id) ?? null
        ),
      },
      equipment_requests: { findUnique: vi.fn(async () => null) },
    },
  };
});
vi.mock("@/auth", () => ({ auth: vi.fn(async () => ({ user: { id: String(currentUser) } })) }));
vi.mock("@/lib/auth-utils", () => ({ hasModuleAccess: vi.fn(async () => true), isAdmin: vi.fn(async () => false) }));
vi.mock("@/lib/email", () => ({ sendEquipmentRequestResultEmail: vi.fn() }));
vi.mock("@/lib/notifications-dismiss", () => ({ dismissNotificationsForLink: vi.fn() }));
vi.mock("@/lib/user-email-notifications-db", () => ({ userAllowsEmailNotification: vi.fn() }));

let currentUser = 35;

import { isInDepartment } from "./equipment-departments";
import { PATCH as approve } from "@/app/api/equipment/requests/[id]/approve/route";
import { PATCH as resolve } from "@/app/api/equipment/requests/[id]/resolve/route";

const call = (handler: typeof approve, body: unknown = { action: "approve" }) =>
  handler(new Request("http://x/api", { method: "PATCH", body: JSON.stringify(body) }) as never, {
    params: Promise.resolve({ id: "7" }),
  });

beforeEach(() => {
  currentUser = 35;
});

describe("isInDepartment", () => {
  it("najde oddělení podle kódu („IT“ = „IT oddělení“)", async () => {
    await expect(isInDepartment(35, "IT")).resolves.toBe(true);
  });

  it("počítá i vedlejší oddělení", async () => {
    await expect(isInDepartment(48, "IT")).resolves.toBe(true);
  });

  it("v neaktivním oddělení nikoho nenajde", async () => {
    await expect(isInDepartment(70, "OLD")).resolves.toBe(false);
  });
});

describe("požadavky: člen IT bez globálního admina", () => {
  it("projde kontrolou u schválení (dál až „požadavek nenalezen“, ne 403)", async () => {
    expect((await call(approve)).status).toBe(404);
  });

  it("projde kontrolou u vyřízení", async () => {
    expect((await call(resolve, {})).status).toBe(404);
  });

  it("uživatel mimo IT a Vedení kontrolou neprojde", async () => {
    currentUser = 70;
    expect((await call(approve)).status).toBe(403);
  });
});
