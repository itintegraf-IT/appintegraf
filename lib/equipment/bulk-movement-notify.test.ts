import { beforeEach, describe, expect, it, vi } from "vitest";

// Hromadné akce posílají jednu souhrnnou notifikaci, ne jednu za každou položku.
vi.mock("@/lib/equipment-movement-notify", () => ({
  notifyEquipmentRoomTransfer: vi.fn(async () => undefined),
  notifyEquipmentRoomTransferBulk: vi.fn(async () => undefined),
  notifyEquipmentAssigned: vi.fn(async () => undefined),
  notifyEquipmentAssignedBulk: vi.fn(async () => undefined),
}));
vi.mock("@/lib/equipment/audit", () => ({ logEquipmentAuditSafe: vi.fn(async () => undefined) }));
vi.mock("@/lib/equipment/assign-to-user", () => ({
  assignEquipmentToUser: vi.fn(async (p: { equipmentId: number }) => ({ assignmentId: 500 + p.equipmentId })),
}));
vi.mock("@/auth", () => ({ auth: vi.fn(async () => ({ user: { id: "1" } })) }));
vi.mock("@/lib/auth-utils", () => ({ isAdmin: vi.fn(async () => true), hasModuleAccess: vi.fn(async () => true) }));
vi.mock("@/lib/db", () => {
  let historyId = 0;
  const tx = {
    equipment_items: { update: vi.fn(async () => ({})) },
    equipment_location_history: {
      create: vi.fn(async () => ({ id: ++historyId })),
      update: vi.fn(async ({ where }: { where: { id: number } }) => ({ id: where.id, protocol_number: `PM-${where.id}` })),
    },
  };
  return {
    prisma: {
      equipment_items: { findUnique: vi.fn(async ({ where }: { where: { id: number } }) => ({ id: where.id, room_id: 5, status: "skladem" })) },
      equipment_rooms: { findUnique: vi.fn(async () => ({ id: 80, name: "Kancelář", code: "1012", is_active: true })) },
      users: { findFirst: vi.fn(async () => ({ id: 70 })) },
      $transaction: vi.fn(async (fn: (t: typeof tx) => unknown) => fn(tx)),
    },
  };
});

import {
  notifyEquipmentAssigned,
  notifyEquipmentAssignedBulk,
  notifyEquipmentRoomTransfer,
  notifyEquipmentRoomTransferBulk,
} from "@/lib/equipment-movement-notify";
import { transferManyEquipmentToRoom } from "./room-transfer";
import { POST as assignBulk } from "@/app/api/equipment/assign-bulk/route";

beforeEach(() => vi.clearAllMocks());

describe("hromadný přesun do místnosti", () => {
  it("3 kusy s notifikací → jeden souhrn, žádná notifikace po kusech", async () => {
    await transferManyEquipmentToRoom({ equipmentIds: [11, 12, 13], toRoomId: 80, userId: 1, notify: true });
    expect(notifyEquipmentRoomTransfer).not.toHaveBeenCalled();
    expect(notifyEquipmentRoomTransferBulk).toHaveBeenCalledTimes(1);
    expect(vi.mocked(notifyEquipmentRoomTransferBulk).mock.calls[0][0]).toMatchObject({
      toRoomId: 80,
      transfers: [{ equipmentId: 11 }, { equipmentId: 12 }, { equipmentId: 13 }],
    });
  });

  it("bez souhlasu s notifikací nic neodejde", async () => {
    await transferManyEquipmentToRoom({ equipmentIds: [11, 12], toRoomId: 80, userId: 1, notify: false });
    expect(notifyEquipmentRoomTransfer).not.toHaveBeenCalled();
    expect(notifyEquipmentRoomTransferBulk).not.toHaveBeenCalled();
  });
});

describe("hromadné přiřazení", () => {
  it("3 kusy s notifikací → jeden souhrn, žádná notifikace po kusech", async () => {
    const res = await assignBulk(
      new Request("http://x/api", {
        method: "POST",
        body: JSON.stringify({ user_id: 70, equipment_ids: [11, 12, 13], notify: true }),
      }) as never
    );
    expect(res.status).toBe(200);
    expect(notifyEquipmentAssigned).not.toHaveBeenCalled();
    expect(notifyEquipmentAssignedBulk).toHaveBeenCalledWith({ equipmentIds: [11, 12, 13], holderUserId: 70 });
  });
});
