import { beforeEach, describe, expect, it, vi } from "vitest";

const ADMIN = 1;

const create = vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({ id: 9, ...data }));
const audit = vi.fn<(params: unknown) => Promise<void>>(async () => undefined);

vi.mock("@/lib/db", () => ({
  prisma: {
    equipment_categories: {
      findUnique: vi.fn(async () => null),
      create: (args: { data: Record<string, unknown> }) => create(args),
    },
  },
}));
vi.mock("@/auth", () => ({ auth: vi.fn(async () => ({ user: { id: String(ADMIN) } })) }));
vi.mock("@/lib/equipment/access", () => ({
  canAdministerEquipment: vi.fn(async (userId: number) => userId === ADMIN),
  canReadEquipment: vi.fn(async () => true),
  getAccessibleCategoryIds: vi.fn(async () => null),
  getWritableCategoryIds: vi.fn(async () => null),
}));
vi.mock("@/lib/equipment/audit", () => ({
  logEquipmentAuditSafe: (params: unknown) => audit(params),
}));

import { POST } from "@/app/api/equipment/categories/route";

const post = (body: unknown) =>
  POST(new Request("http://x/api", { method: "POST", body: JSON.stringify(body) }) as never);

beforeEach(() => {
  create.mockClear();
  audit.mockClear();
});

describe("POST skupiny majetku — štítky", () => {
  it("skupina založená s vypnutými štítky se do „Bez štítku“ nepočítá", async () => {
    const res = await post({ name: "Auta", code: "au", label_required: false });
    expect(res.status).toBe(201);
    expect(create).toHaveBeenCalledWith({ data: expect.objectContaining({ label_required: false }) });
    expect(audit).toHaveBeenCalledWith(
      expect.objectContaining({ action: "category_create", detail: expect.objectContaining({ label_required: false }) })
    );
  });

  it("bez volby se štítky tisknou (výchozí stav)", async () => {
    await post({ name: "Notebooky", code: "nb" });
    expect(create).toHaveBeenCalledWith({ data: expect.objectContaining({ label_required: true }) });
  });
});
