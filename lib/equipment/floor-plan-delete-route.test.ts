import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => {
  const state = { admin: true, drawn: 0, plan: { id: 3, is_active: true } as { id: number; is_active: boolean } | null };
  const tx = {
    equipment_rooms: { findMany: vi.fn(async () => [{ id: 11 }]), updateMany: vi.fn(async () => ({ count: 1 })) },
    equipment_floor_plans: { update: vi.fn(async () => ({})) },
  };
  const audit = vi.fn<(params: unknown, db?: unknown) => Promise<void>>(async () => undefined);
  const transaction = vi.fn(async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx));
  return { state, tx, audit, transaction };
});

vi.mock("@/auth", () => ({ auth: vi.fn(async () => ({ user: { id: "1" } })) }));
vi.mock("@/lib/equipment/access", () => ({
  canAdministerEquipment: vi.fn(async () => h.state.admin),
  canReadEquipment: vi.fn(async () => true),
  getAccessibleCategoryIds: vi.fn(async () => null),
}));
vi.mock("@/lib/db", () => ({
  prisma: {
    equipment_floor_plans: { findUnique: vi.fn(async () => h.state.plan) },
    equipment_rooms: { count: vi.fn(async () => h.state.drawn) },
    $transaction: h.transaction,
  },
}));
vi.mock("@/lib/equipment/audit", () => ({
  logEquipmentAudit: (p: unknown, db?: unknown) => h.audit(p, db),
  logEquipmentAuditSafe: vi.fn(async () => undefined),
}));

import { DELETE } from "@/app/api/equipment/floor-plans/[id]/route";

const del = (id = "3") =>
  DELETE(new Request(`http://x/api/equipment/floor-plans/${id}`, { method: "DELETE" }) as never, {
    params: Promise.resolve({ id }),
  });

beforeEach(() => {
  h.state.admin = true;
  h.state.drawn = 0;
  h.state.plan = { id: 3, is_active: true };
  h.transaction.mockClear();
  h.audit.mockClear();
  h.tx.equipment_rooms.updateMany.mockClear();
});

describe("DELETE /api/equipment/floor-plans/[id]", () => {
  it("plánek se zakreslenými místnostmi odmítne 409 a nic nezmění", async () => {
    h.state.drawn = 4;
    const res = await del();
    expect(res.status).toBe(409);
    await expect(res.json()).resolves.toMatchObject({ error: expect.stringContaining("4") });
    expect(h.transaction).not.toHaveBeenCalled();
  });

  it("plánek bez zakreslených místností vypne a odpojí místnosti bez obrysu, s auditem v transakci", async () => {
    const res = await del();
    expect(res.status).toBe(200);
    expect(h.tx.equipment_rooms.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { floor_plan_id: 3 }, data: expect.not.objectContaining({ polygon_json: null }) })
    );
    expect(h.audit).toHaveBeenCalledWith(expect.objectContaining({ action: "floor_plan_deactivate", oldValues: { is_active: true } }), h.tx);
  });

  it("neexistující plánek 404, bez práva 403", async () => {
    h.state.plan = null;
    expect((await del()).status).toBe(404);
    h.state.admin = false;
    expect((await del()).status).toBe(403);
  });
});
