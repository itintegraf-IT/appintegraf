import { beforeEach, describe, expect, it, vi } from "vitest";

// 1 = správa evidence (Editor Majetku), 2 = zodpovědná osoba skupiny 3 bez úrovně Editor.
const EDITOR = 1;
const RESPONSIBLE = 2;
let currentUser = EDITOR;

const transaction = vi.fn(async () => ({ status: "created", inventory: { id: 9 }, lines: 0 }));

vi.mock("@/auth", () => ({ auth: vi.fn(async () => ({ user: { id: String(currentUser) } })) }));
vi.mock("@/lib/equipment/access", () => ({
  canAdministerEquipment: vi.fn(async () => false),
  canManageRegister: vi.fn(async (userId: number) => userId === EDITOR),
  canReadEquipment: vi.fn(async () => true),
  // Zodpovědná osoba zapisuje do své skupiny 3 (a „do některé skupiny“ bez id).
  canWriteEquipment: vi.fn(async (userId: number, categoryId?: number) =>
    userId === EDITOR ? true : categoryId === undefined || categoryId === 3
  ),
  getAccessibleCategoryIds: vi.fn(async (userId: number) => (userId === EDITOR ? null : [3])),
}));
vi.mock("@/lib/equipment/audit", () => ({ logEquipmentAuditSafe: vi.fn(async () => undefined) }));
vi.mock("@/lib/db", () => ({ prisma: { $transaction: () => transaction() } }));

import { POST } from "@/app/api/equipment/inventories/route";

const create = (body: unknown) =>
  POST(new Request("http://x/api/equipment/inventories", { method: "POST", body: JSON.stringify(body) }) as never);

beforeEach(() => {
  currentUser = EDITOR;
  transaction.mockClear();
});

describe("POST /api/equipment/inventories — kdo zakládá inventuru", () => {
  it("správa evidence založí inventuru místnosti", async () => {
    const res = await create({ scope_type: "room", scope_id: 80 });
    expect(res.status).toBe(201);
  });

  it("zodpovědná osoba skupiny inventuru místnosti nezaloží (neúplný seznam by blokoval ostatní)", async () => {
    currentUser = RESPONSIBLE;
    const res = await create({ scope_type: "room", scope_id: 80 });
    expect(res.status).toBe(403);
    expect(transaction).not.toHaveBeenCalled();
  });

  it("zodpovědná osoba založí inventuru své skupiny", async () => {
    currentUser = RESPONSIBLE;
    const res = await create({ scope_type: "category", scope_id: 3 });
    expect(res.status).toBe(201);
  });
});
