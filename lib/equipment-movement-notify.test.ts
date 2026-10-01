import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({ prisma: { users: { findMany: vi.fn() } } }));
vi.mock("@/lib/email", () => ({ sendEquipmentMovementEmail: vi.fn() }));
vi.mock("@/lib/equipment-departments", () => ({ getDepartmentMembers: vi.fn() }));
vi.mock("@/lib/equipment/movement-extra-recipients", () => ({ getExtraMovementNotifyUserIds: vi.fn() }));
vi.mock("@/lib/user-email-notifications-db", () => ({ filterUserIdsAllowingEmail: vi.fn() }));

import { prisma } from "@/lib/db";
import { getDepartmentMembers } from "@/lib/equipment-departments";
import { getExtraMovementNotifyUserIds } from "@/lib/equipment/movement-extra-recipients";
import { collectMovementRecipients } from "./equipment-movement-notify";

const user = (id: number) => ({ id, first_name: `U${id}`, last_name: "Test", email: `u${id}@example.com` });

beforeEach(() => {
  vi.clearAllMocks();
  // Jako skutečná DB: oddělení „Účetnictví“ s kódem ACC; žádné „Účtárna“ neexistuje.
  vi.mocked(getDepartmentMembers).mockImplementation(async (key: string) =>
    key === "ACC" || key === "Účetnictví" ? [user(48), user(60)] : []
  );
  vi.mocked(getExtraMovementNotifyUserIds).mockResolvedValue([]);
  vi.mocked(prisma.users.findMany).mockImplementation((async (args: { where: { id: { in: number[] } } }) =>
    args.where.id.in.map(user)) as never);
});

describe("collectMovementRecipients", () => {
  it("účtárna (oddělení Účetnictví, kód ACC) dostane notifikaci o pohybu majetku", async () => {
    const ids = (await collectMovementRecipients(null)).map((r) => r.id);
    expect(ids).toEqual(expect.arrayContaining([48, 60]));
  });

  it("držitel, účtárna a další příjemci bez duplicit", async () => {
    vi.mocked(getExtraMovementNotifyUserIds).mockResolvedValue([60, 77]);
    const ids = (await collectMovementRecipients(48)).map((r) => r.id).sort((a, b) => a - b);
    expect(ids).toEqual([48, 60, 77]);
  });
});
