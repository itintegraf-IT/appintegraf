import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({ prisma: { audit_log: { create: vi.fn() } } }));

import { logEquipmentAudit } from "./audit";

describe("logEquipmentAudit", () => {
  it("zapíše přes předaného klienta (např. transakci), ne přes globální", async () => {
    const create = vi.fn();
    await logEquipmentAudit({ userId: 1, action: "item_delete", recordId: 5, oldValues: { name: "X" } }, {
      audit_log: { create },
    } as never);
    expect(create).toHaveBeenCalledOnce();
    expect(create.mock.calls[0][0].data).toMatchObject({ user_id: 1, action: "item_delete", record_id: 5 });
  });

  it("hodnoty typu BigInt nezpůsobí tichou ztrátu auditu", async () => {
    const create = vi.fn();
    await logEquipmentAudit({ userId: 1, action: "x", oldValues: { size: BigInt(12) } }, { audit_log: { create } } as never);
    expect(JSON.parse(create.mock.calls[0][0].data.old_values)).toEqual({ size: "12" });
  });
});
