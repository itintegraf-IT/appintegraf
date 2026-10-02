import { beforeEach, describe, expect, it, vi } from "vitest";

// 1 = Editor Majetku (účetní), 2 = zodpovědná osoba skupiny bez úrovně Editor.
const EDITOR = 1;
const RESPONSIBLE = 2;
let currentUser = EDITOR;

const transaction = vi.fn(async () => [{ id: 501, asset_tag: "100900", qr_code: "QR1", serial_number: null }]);

vi.mock("@/auth", () => ({ auth: vi.fn(async () => ({ user: { id: String(currentUser) } })) }));
vi.mock("@/lib/equipment/access", () => ({
  canManageRegister: vi.fn(async (userId: number) => userId === EDITOR),
  // Zodpovědná osoba smí zapisovat do své skupiny (přiřazení, vrácení…).
  canWriteEquipment: vi.fn(async () => true),
  canReadEquipment: vi.fn(async () => true),
  getAccessibleCategoryIds: vi.fn(async () => null),
}));
vi.mock("@/lib/db", () => ({
  prisma: {
    equipment_categories: { findUnique: vi.fn(async () => ({ is_active: true })) },
    equipment_rooms: { findUnique: vi.fn(async () => ({ is_active: true })) },
    equipment_items: { findMany: vi.fn(async () => []) },
    $transaction: () => transaction(),
  },
}));
vi.mock("@/lib/equipment/qr", () => ({ generateUniqueEqQrCode: vi.fn(async () => "QR1") }));
vi.mock("@/lib/equipment/qr-pool", () => ({
  claimPoolCodeForNewItem: vi.fn(),
  PoolCodeError: class PoolCodeError extends Error {},
}));
vi.mock("@/lib/equipment/audit", () => ({ logEquipmentAuditSafe: vi.fn(async () => undefined) }));

import { POST } from "@/app/api/equipment/route";

const purchase = {
  name: "Monitor Dell",
  category_id: "3",
  purchase_date: "2026-09-28",
  purchase_price: "5 990",
  invoice_number: "FP-2026-0815",
};
const post = (body: unknown) =>
  POST(new Request("http://x/api/equipment", { method: "POST", body: JSON.stringify(body) }) as never);

beforeEach(() => {
  currentUser = EDITOR;
  transaction.mockClear();
});

describe("POST /api/equipment — kdo zařazuje nákupy", () => {
  it("Editor Majetku (účtárna) zařadí a dostane číslo z řady", async () => {
    const res = await post(purchase);
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({ asset_tags: ["100900"] });
  });

  it("zodpovědná osoba skupiny bez úrovně Editor nezařazuje (nečerpá čísla řady)", async () => {
    currentUser = RESPONSIBLE;
    const res = await post(purchase);
    expect(res.status).toBe(403);
    expect(transaction).not.toHaveBeenCalled();
  });
});
