/**
 * Příprava dat — načtení podkladů pro plánovače a provedení schválených párů.
 * Provede jen páry, které jsou v plánu i v okamžiku zápisu; každý zápis je podmíněný,
 * takže opakované spuštění nic nezdvojí. Bez notifikací a bez protokolů přesunu.
 */

import type { PrismaTransactionClient } from "@/lib/db";
import { EQUIPMENT_ITEM_STATUS } from "@/lib/equipment-status";
import { logEquipmentAudit } from "@/lib/equipment/audit";
import { TRANSFER_SOURCE_IMPORT } from "@/lib/equipment/transfer-source";
import { planHolderAssignments, type HolderPlan } from "@/lib/equipment/data-prep/holder-match";
import { planRoomAssignments, type RoomPlan } from "@/lib/equipment/data-prep/location-match";

type Db = Pick<
  PrismaTransactionClient,
  "equipment_items" | "equipment_rooms" | "equipment_assignments" | "users"
>;

export type ItemInfo = { assetTag: string | null; name: string };

export async function loadRoomPlan(db: Db): Promise<{
  plan: RoomPlan;
  itemInfo: Map<number, ItemInfo>;
  rooms: Map<number, { code: string; name: string }>;
}> {
  const items = await db.equipment_items.findMany({
    select: { id: true, name: true, asset_tag: true, location: true, room_id: true, status: true },
  });
  const rooms = await db.equipment_rooms.findMany({
    select: { id: true, code: true, name: true, description: true, is_active: true },
  });
  return {
    plan: planRoomAssignments(items, rooms),
    itemInfo: new Map(items.map((i) => [i.id, { assetTag: i.asset_tag, name: i.name }])),
    rooms: new Map(rooms.map((r) => [r.id, { code: r.code, name: r.name }])),
  };
}

export async function loadHolderPlan(db: Db): Promise<{
  plan: HolderPlan;
  itemInfo: Map<number, ItemInfo>;
  users: Map<number, string>;
}> {
  const items = await db.equipment_items.findMany({
    where: { notes: { contains: "Pracovník:" } },
    select: {
      id: true,
      name: true,
      asset_tag: true,
      notes: true,
      status: true,
      equipment_assignments: { where: { returned_at: null }, select: { id: true }, take: 1 },
    },
  });
  const users = await db.users.findMany({
    where: { OR: [{ is_active: true }, { is_active: null }] },
    select: { id: true, first_name: true, last_name: true },
  });
  const open = await db.equipment_assignments.findMany({
    where: { returned_at: null },
    select: { user_id: true, equipment_items: { select: { name: true } } },
  });
  const plan = planHolderAssignments(
    items.map((i) => ({
      id: i.id,
      name: i.name,
      notes: i.notes,
      status: i.status,
      hasOpenAssignment: i.equipment_assignments.length > 0,
    })),
    users,
    open.map((a) => ({ userId: a.user_id, itemName: a.equipment_items.name }))
  );
  return {
    plan,
    itemInfo: new Map(items.map((i) => [i.id, { assetTag: i.asset_tag, name: i.name }])),
    users: new Map(users.map((u) => [u.id, `${u.last_name} ${u.first_name}`])),
  };
}

export type Skipped = { itemId: number; reason: "changed" };

/** Zařadí schválené páry položka → místnost (historie „Z původní evidence“, původní text zůstane). */
export async function applyRoomPairs(
  tx: PrismaTransactionClient,
  pairs: { itemId: number; roomId: number }[],
  userId: number
): Promise<{ applied: number; skipped: Skipped[] }> {
  const { plan } = await loadRoomPlan(tx);
  const planned = new Map([...plan.auto, ...plan.suggest].map((p) => [p.itemId, p]));
  const applied: typeof plan.auto = [];
  const skipped: Skipped[] = [];

  for (const pair of [...pairs].sort((a, b) => a.itemId - b.itemId)) {
    const step = planned.get(pair.itemId);
    if (!step || step.roomId !== pair.roomId) {
      skipped.push({ itemId: pair.itemId, reason: "changed" });
      continue;
    }
    const res = await tx.equipment_items.updateMany({
      where: {
        id: pair.itemId,
        room_id: null,
        OR: [{ status: null }, { status: { not: EQUIPMENT_ITEM_STATUS.VYRAZENO } }],
      },
      data: { room_id: pair.roomId },
    });
    if (res.count !== 1) {
      skipped.push({ itemId: pair.itemId, reason: "changed" });
      continue;
    }
    applied.push(step);
  }

  if (applied.length > 0) {
    await tx.equipment_location_history.createMany({
      data: applied.map((p) => ({
        equipment_id: p.itemId,
        from_room_id: null,
        to_room_id: p.roomId,
        transferred_by: userId,
        source: TRANSFER_SOURCE_IMPORT,
        notes: `Z původní evidence: ${p.location}`.slice(0, 1000),
      })),
    });
    await logEquipmentAudit(
      {
        userId,
        action: "data_prep_rooms",
        tableName: "equipment_items",
        detail: {
          count: applied.length,
          pairs: applied.map((p) => ({ itemId: p.itemId, roomId: p.roomId, reason: p.reason })),
        },
        oldValues: { room_id: null, location: Object.fromEntries(applied.map((p) => [p.itemId, p.location])) },
      },
      tx
    );
  }
  return { applied: applied.length, skipped };
}

/** Přiřadí schválené páry položka → držitel (stav Přiřazeno, bez notifikace). */
export async function applyHolderPairs(
  tx: PrismaTransactionClient,
  pairs: { itemId: number; userId: number }[],
  adminUserId: number
): Promise<{ applied: number; skipped: Skipped[] }> {
  const { plan } = await loadHolderPlan(tx);
  const planned = new Map(plan.rows.map((r) => [r.itemId, r]));
  const applied: typeof plan.rows = [];
  const skipped: Skipped[] = [];

  for (const pair of [...pairs].sort((a, b) => a.itemId - b.itemId)) {
    const step = planned.get(pair.itemId);
    if (!step || step.userId !== pair.userId) {
      skipped.push({ itemId: pair.itemId, reason: "changed" });
      continue;
    }
    const open = await tx.equipment_assignments.count({ where: { equipment_id: pair.itemId, returned_at: null } });
    const res = open
      ? { count: 0 }
      : await tx.equipment_items.updateMany({
          where: { id: pair.itemId, status: EQUIPMENT_ITEM_STATUS.SKLADEM },
          data: { status: EQUIPMENT_ITEM_STATUS.PRIRAZENO },
        });
    if (res.count !== 1) {
      skipped.push({ itemId: pair.itemId, reason: "changed" });
      continue;
    }
    await tx.equipment_assignments.create({
      data: {
        equipment_id: pair.itemId,
        user_id: pair.userId,
        assigned_by: adminUserId,
        notes: `Z původní evidence (Pracovník: ${step.holderText})`.slice(0, 1000),
      },
    });
    applied.push(step);
  }

  if (applied.length > 0) {
    await logEquipmentAudit(
      {
        userId: adminUserId,
        action: "data_prep_holders",
        tableName: "equipment_assignments",
        detail: {
          count: applied.length,
          pairs: applied.map((r) => ({ itemId: r.itemId, userId: r.userId, kind: r.kind })),
        },
        oldValues: { status: EQUIPMENT_ITEM_STATUS.SKLADEM, assignment: null },
      },
      tx
    );
  }
  return { applied: applied.length, skipped };
}
