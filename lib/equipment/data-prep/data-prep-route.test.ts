import { beforeEach, describe, expect, it, vi } from "vitest";

type ItemRow = {
  id: number;
  name: string;
  asset_tag: string | null;
  location: string | null;
  room_id: number | null;
  status: string | null;
  notes: string | null;
  equipment_assignments: { id: number; returned_at?: Date | null }[];
};

const ADMIN = 1;
const OTHER = 2;

const h = vi.hoisted(() => {
  const state = { currentUser: 1, inventoriesInProgress: 0, items: [] as ItemRow[] };
  const rooms = [{ id: 7, code: "1001", name: "Recepce hlavní vstup", description: null, is_active: true }];
  const users = [{ id: 40, first_name: "Jan", last_name: "Novák" }];
  const itemsUpdateMany = vi.fn(async (args: { where: { id: number }; data: Record<string, unknown> }) => {
    const row = state.items.find((i) => i.id === args.where.id);
    if (!row) return { count: 0 };
    if ("room_id" in args.data) {
      if (row.room_id != null) return { count: 0 };
      row.room_id = args.data.room_id as number;
    }
    if ("status" in args.data) {
      if (row.status !== "skladem") return { count: 0 };
      row.status = args.data.status as string;
    }
    return { count: 1 };
  });
  const historyCreateMany = vi.fn(async () => ({ count: 0 }));
  const assignmentCreate = vi.fn(async () => ({ id: 1 }));
  type FindArgs = { select?: { equipment_assignments?: { where?: { returned_at?: null } } } };
  const tx = {
    equipment_items: {
      // Jako DB: `where: { returned_at: null }` u vnořeného výběru vrátí jen otevřená přiřazení.
      findMany: vi.fn(async (args?: FindArgs) =>
        args?.select?.equipment_assignments?.where?.returned_at === null
          ? state.items.map((i) => ({ ...i, equipment_assignments: i.equipment_assignments.filter((a) => !a.returned_at) }))
          : state.items
      ),
      updateMany: itemsUpdateMany,
    },
    equipment_rooms: { findMany: vi.fn(async () => rooms) },
    equipment_location_history: { createMany: historyCreateMany },
    equipment_assignments: { findMany: vi.fn(async () => []), count: vi.fn(async () => 0), create: assignmentCreate },
    users: { findMany: vi.fn(async () => users) },
  };
  const audit = vi.fn<(params: unknown, db?: unknown) => Promise<void>>(async () => undefined);
  return { state, tx, itemsUpdateMany, historyCreateMany, assignmentCreate, audit };
});
const { state, tx, itemsUpdateMany, historyCreateMany, assignmentCreate, audit } = h;

vi.mock("@/auth", () => ({ auth: vi.fn(async () => ({ user: { id: String(h.state.currentUser) } })) }));
vi.mock("@/lib/equipment/access", () => ({
  canAdministerEquipment: vi.fn(async (userId: number) => userId === 1),
}));
vi.mock("@/lib/db", () => ({
  prisma: {
    ...h.tx,
    equipment_inventories: { count: vi.fn(async () => h.state.inventoriesInProgress) },
    $transaction: vi.fn(async (fn: (t: typeof h.tx) => Promise<unknown>) => fn(h.tx)),
  },
}));
vi.mock("@/lib/equipment/audit", () => ({ logEquipmentAudit: (p: unknown, db?: unknown) => h.audit(p, db) }));

import { GET, POST } from "@/app/api/equipment/data-prep/[step]/route";

const call = (method: "GET" | "POST", step: string, body?: unknown) =>
  (method === "GET" ? GET : POST)(
    new Request(`http://x/api/equipment/data-prep/${step}`, {
      method,
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    }) as never,
    { params: Promise.resolve({ step }) }
  );

const row = (id: number, location: string | null, extra: Partial<ItemRow> = {}): ItemRow => ({
  id,
  name: `Položka ${id}`,
  asset_tag: String(100000 + id),
  location,
  room_id: null,
  status: "skladem",
  notes: null,
  equipment_assignments: [],
  ...extra,
});

beforeEach(() => {
  state.currentUser = ADMIN;
  state.inventoriesInProgress = 0;
  state.items = [row(1, "Recepce hlavní vstup (1001)"), row(2, "tiskarna (s20000)")];
  for (const fn of [itemsUpdateMany, historyCreateMany, assignmentCreate, audit]) fn.mockClear();
});

describe("data-prep — místnosti", () => {
  it("bez správy Majetku 403", async () => {
    state.currentUser = OTHER;
    expect((await call("GET", "rooms")).status).toBe(403);
    expect((await call("POST", "rooms", { pairs: [{ itemId: 1, roomId: 7 }] })).status).toBe(403);
  });

  it("náhled vrátí automatické páry a skupiny", async () => {
    const res = await call("GET", "rooms");
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.auto).toEqual([expect.objectContaining({ itemId: 1, roomId: 7, roomCode: "1001", assetTag: "100001" })]);
    expect(data.groups[0]).toMatchObject({ label: "tiskarna (s20000)", count: 1 });
  });

  it("během probíhající inventury 409 a nic se nezmění", async () => {
    state.inventoriesInProgress = 1;
    const res = await call("POST", "rooms", { pairs: [{ itemId: 1, roomId: 7 }] });
    expect(res.status).toBe(409);
    expect(itemsUpdateMany).not.toHaveBeenCalled();
  });

  it("provede pár z plánu: místnost, historie „Z původní evidence“ bez protokolu, audit v transakci", async () => {
    const res = await call("POST", "rooms", { pairs: [{ itemId: 1, roomId: 7 }] });
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ applied: 1, skipped: [] });
    expect(itemsUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ id: 1, room_id: null }), data: { room_id: 7 } })
    );
    expect(historyCreateMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          equipment_id: 1,
          from_room_id: null,
          to_room_id: 7,
          transferred_by: ADMIN,
          source: "import",
          notes: "Z původní evidence: Recepce hlavní vstup (1001)",
        }),
      ],
    });
    expect(audit).toHaveBeenCalledWith(expect.objectContaining({ action: "data_prep_rooms" }), tx);
  });

  it("pár, který v plánu není (jiná místnost), se přeskočí", async () => {
    const res = await call("POST", "rooms", { pairs: [{ itemId: 1, roomId: 99 }] });
    await expect(res.json()).resolves.toEqual({ applied: 0, skipped: [{ itemId: 1, reason: "changed" }] });
    expect(itemsUpdateMany).not.toHaveBeenCalled();
    expect(audit).not.toHaveBeenCalled();
  });

  it("opakované provedení nic nezdvojí", async () => {
    await call("POST", "rooms", { pairs: [{ itemId: 1, roomId: 7 }] });
    historyCreateMany.mockClear();
    const res = await call("POST", "rooms", { pairs: [{ itemId: 1, roomId: 7 }] });
    await expect(res.json()).resolves.toEqual({ applied: 0, skipped: [{ itemId: 1, reason: "changed" }] });
    expect(historyCreateMany).not.toHaveBeenCalled();
  });

  it("nesmyslné tělo 400", async () => {
    expect((await call("POST", "rooms", { pairs: "x" })).status).toBe(400);
    expect((await call("POST", "nic", { pairs: [] })).status).toBe(404);
  });
});

describe("data-prep — držitelé", () => {
  it("přiřadí držitele z plánu bez notifikace a s auditem", async () => {
    state.items = [row(5, null, { notes: "Pracovník: Novák Jan" })];
    const res = await call("POST", "holders", { pairs: [{ itemId: 5, userId: 40 }] });
    await expect(res.json()).resolves.toEqual({ applied: 1, skipped: [] });
    expect(itemsUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ id: 5, status: "skladem" }), data: { status: "přiřazeno" } })
    );
    expect(assignmentCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ equipment_id: 5, user_id: 40, assigned_by: ADMIN }),
    });
    expect(audit).toHaveBeenCalledWith(expect.objectContaining({ action: "data_prep_holders" }), tx);
  });

  it("položku, kterou už držitel v aplikaci vrátil, znovu nepřiřadí (poznámka je starší než historie)", async () => {
    state.items = [
      row(6, null, { notes: "Pracovník: Novák Jan", equipment_assignments: [{ id: 3, returned_at: new Date("2026-08-01") }] }),
    ];
    const res = await call("POST", "holders", { pairs: [{ itemId: 6, userId: 40 }] });
    await expect(res.json()).resolves.toEqual({ applied: 0, skipped: [{ itemId: 6, reason: "changed" }] });
    expect(assignmentCreate).not.toHaveBeenCalled();
    expect(itemsUpdateMany).not.toHaveBeenCalled();
  });
});
