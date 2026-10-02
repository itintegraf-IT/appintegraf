import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: {
    users: { findMany: vi.fn() },
    equipment_items: { findMany: vi.fn() },
    equipment_rooms: { findUnique: vi.fn() },
    equipment_assignments: { findMany: vi.fn() },
    notifications: { create: vi.fn() },
  },
}));
vi.mock("@/lib/email", () => ({ sendEquipmentMovementEmail: vi.fn() }));
vi.mock("@/lib/equipment-departments", () => ({ getDepartmentMembers: vi.fn() }));
vi.mock("@/lib/equipment/movement-extra-recipients", () => ({ getExtraMovementNotifyUserIds: vi.fn() }));
vi.mock("@/lib/user-email-notifications-db", () => ({ filterUserIdsAllowingEmail: vi.fn() }));

import { prisma } from "@/lib/db";
import { sendEquipmentMovementEmail } from "@/lib/email";
import { getDepartmentMembers } from "@/lib/equipment-departments";
import { getExtraMovementNotifyUserIds } from "@/lib/equipment/movement-extra-recipients";
import { filterUserIdsAllowingEmail } from "@/lib/user-email-notifications-db";
import {
  collectMovementRecipients,
  notifyEquipmentAssignedBulk,
  notifyEquipmentRoomTransferBulk,
} from "./equipment-movement-notify";

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
  vi.mocked(prisma.equipment_items.findMany).mockImplementation((async (args: { where: { id: { in: number[] } } }) =>
    args.where.id.in.map((id) => ({ id, name: `Židle ${id}`, brand: null, model: null }))) as never);
  vi.mocked(prisma.equipment_rooms.findUnique).mockResolvedValue({ code: "1012", name: "Kancelář DTP" } as never);
  vi.mocked(filterUserIdsAllowingEmail).mockImplementation(async (ids: number[]) => ids);
  vi.mocked(sendEquipmentMovementEmail).mockResolvedValue({ success: true } as never);
});

/** Komu odešel e-mail a o kolika kusech (z textu „… N kus/kusy/kusů …“). */
function emailsByRecipient() {
  return vi.mocked(sendEquipmentMovementEmail).mock.calls.map(([arg]) => {
    const a = arg as { toEmail: string; intro: string };
    return { to: a.toEmail, units: /(\d+) kus/.exec(a.intro)?.[1] };
  });
}

describe("hromadné pohyby — jedna souhrnná notifikace na příjemce", () => {
  it("přesun 3 kusů: každá účetní jeden e-mail o 3 kusech, držitel jeden o svých 2", async () => {
    vi.mocked(prisma.equipment_assignments.findMany).mockResolvedValue([
      { equipment_id: 11, user_id: 70 },
      { equipment_id: 12, user_id: 70 },
    ] as never);
    await notifyEquipmentRoomTransferBulk({
      transfers: [
        { historyId: 1, equipmentId: 11 },
        { historyId: 2, equipmentId: 12 },
        { historyId: 3, equipmentId: 13 },
      ],
      toRoomId: 80,
    });
    expect(emailsByRecipient()).toEqual(
      expect.arrayContaining([
        { to: "u48@example.com", units: "3" },
        { to: "u60@example.com", units: "3" },
        { to: "u70@example.com", units: "2" },
      ])
    );
    expect(sendEquipmentMovementEmail).toHaveBeenCalledTimes(3);
    expect(prisma.notifications.create).toHaveBeenCalledTimes(3);
  });

  it("účetní, která je zároveň držitelkou, dostane jen jeden souhrn", async () => {
    vi.mocked(prisma.equipment_assignments.findMany).mockResolvedValue([{ equipment_id: 11, user_id: 48 }] as never);
    await notifyEquipmentRoomTransferBulk({
      transfers: [
        { historyId: 1, equipmentId: 11 },
        { historyId: 2, equipmentId: 12 },
      ],
      toRoomId: 80,
    });
    expect(sendEquipmentMovementEmail).toHaveBeenCalledTimes(2);
  });

  it("hromadné přiřazení 3 kusů jednomu člověku: držitel i účtárna po jednom e-mailu", async () => {
    await notifyEquipmentAssignedBulk({ equipmentIds: [11, 12, 13], holderUserId: 70 });
    expect(emailsByRecipient()).toEqual(
      expect.arrayContaining([
        { to: "u48@example.com", units: "3" },
        { to: "u60@example.com", units: "3" },
        { to: "u70@example.com", units: "3" },
      ])
    );
    expect(sendEquipmentMovementEmail).toHaveBeenCalledTimes(3);
  });
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
