import { beforeEach, describe, expect, it, vi } from "vitest";

// Skupina „Notebooky“, zodpovědná osoba id 12. Uživatel 1 = správce Majetku, 2 = Editor (účetní).
const EXISTING = {
  id: 7,
  name: "Notebooky",
  code: "NB",
  description: null,
  icon: null,
  is_active: true,
  responsible_user_id: 12,
};
const ADMIN = 1;
const EDITOR = 2;
let currentUser = EDITOR;

const update = vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({ ...EXISTING, ...data }));
const audit = vi.fn<(params: unknown) => Promise<void>>(async () => undefined);

vi.mock("@/lib/db", () => ({
  prisma: {
    equipment_categories: {
      findUnique: vi.fn(async () => EXISTING),
      update: (args: { data: Record<string, unknown> }) => update(args),
    },
  },
}));
vi.mock("@/auth", () => ({ auth: vi.fn(async () => ({ user: { id: String(currentUser) } })) }));
vi.mock("@/lib/equipment/access", () => ({
  canAdministerEquipment: vi.fn(async (userId: number) => userId === ADMIN),
  canWriteEquipment: vi.fn(async () => true),
  canReadEquipment: vi.fn(async () => true),
}));
vi.mock("@/lib/equipment/audit", () => ({
  logEquipmentAuditSafe: (params: unknown) => audit(params),
}));

import { PATCH } from "@/app/api/equipment/categories/[id]/route";

const patch = (body: unknown) =>
  PATCH(new Request("http://x/api", { method: "PATCH", body: JSON.stringify(body) }) as never, {
    params: Promise.resolve({ id: "7" }),
  });

beforeEach(() => {
  currentUser = EDITOR;
  update.mockClear();
  audit.mockClear();
});

describe("PATCH skupiny majetku — zodpovědná osoba", () => {
  it("Editor ji změnit nesmí (rozdával by tím právo zápisu do celé skupiny)", async () => {
    const res = await patch({ responsible_user_id: 5 });
    expect(res.status).toBe(403);
    expect(update).not.toHaveBeenCalled();
  });

  it("správce ji změní a audit nese původní i novou hodnotu", async () => {
    currentUser = ADMIN;
    const res = await patch({ responsible_user_id: 5 });
    expect(res.status).toBe(200);
    expect(audit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "category_update",
        detail: { responsible_user_id: 5 },
        oldValues: { responsible_user_id: 12 },
      })
    );
  });
});
