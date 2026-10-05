import { beforeEach, describe, expect, it, vi } from "vitest";

// 1 = správa evidence (Editor), 2 = zodpovědný za skupinu 3 (ne 99), 3 = jen čtenář.
const MANAGER = 1;
const RESPONSIBLE = 2;
let currentUser = MANAGER;

type ItemRow = {
  id: number;
  name: string;
  asset_tag: string | null;
  qr_code: string | null;
  quantity: number;
  category_id: number;
  label_printed_at: Date | null;
  equipment_categories: { name: string };
  equipment_rooms: { name: string } | null;
};
let items: ItemRow[] = [];
const ROOM = { id: 7, label_printed_at: null, name: "Sklad", code: "1001", qr_code: "900000000007", building: null, floor: null };
const itemsUpdateMany = vi.fn(async () => ({ count: 0 }));
const roomsUpdateMany = vi.fn(async () => ({ count: 0 }));
const tx = { equipment_items: { updateMany: itemsUpdateMany }, equipment_rooms: { updateMany: roomsUpdateMany } };

vi.mock("@/auth", () => ({ auth: vi.fn(async () => ({ user: { id: String(currentUser) } })) }));
vi.mock("@/lib/equipment/access", () => ({
  canReadEquipment: vi.fn(async () => true),
  canWriteEquipment: vi.fn(async (userId: number, categoryId?: number) => userId === MANAGER || categoryId === 3),
  canManageRegister: vi.fn(async (userId: number) => userId === MANAGER),
}));
vi.mock("@/lib/db", () => ({
  prisma: {
    equipment_items: {
      findMany: vi.fn(async (args: { where: { id: { in: number[] } } }) => items.filter((i) => args.where.id.in.includes(i.id))),
      findUnique: vi.fn(async (args: { where: { id: number } }) => items.find((i) => i.id === args.where.id) ?? null),
    },
    equipment_rooms: {
      findMany: vi.fn(async () => [ROOM]),
      findUnique: vi.fn(async () => ROOM),
    },
    $transaction: vi.fn(async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx)),
  },
}));
vi.mock("@/lib/equipment/label-grid-settings", () => ({
  resolveEquipmentLabelGrid: vi.fn(async () => ({
    settings: { ownerText: "Majetek Integraf, s.r.o." },
    spec: { cols: 3, rows: 8, labelWidthMm: 70, labelHeightMm: 37, marginTopMm: 0.5, marginLeftMm: 0, colGapMm: 0, rowGapMm: 0 },
  })),
}));
const buildItems = vi.fn(async () => new Uint8Array([37, 80, 68, 70]));
const buildOther = vi.fn(async () => new Uint8Array([37, 80, 68, 70]));
vi.mock("@/lib/equipment/label-pdf", () => ({
  buildEquipmentLabelsBulkPdf: (...args: unknown[]) => buildItems(...(args as [])),
  buildEquipmentLabelPdf: () => buildOther(),
  buildRoomLabelPdf: () => buildOther(),
  buildRoomLabelsBulkPdf: () => buildOther(),
}));
const audit = vi.fn<(params: unknown, db?: unknown) => Promise<void>>(async () => undefined);
vi.mock("@/lib/equipment/audit", () => ({ logEquipmentAudit: (p: unknown, db?: unknown) => audit(p, db) }));

import { POST as printItems } from "@/app/api/equipment/labels/route";
import { POST as printRooms } from "@/app/api/equipment/rooms/labels/route";
import { GET as printItem } from "@/app/api/equipment/[id]/label/route";
import { GET as printRoom } from "@/app/api/equipment/rooms/[id]/label/route";
import { POST as confirm } from "@/app/api/equipment/labels/confirm/route";

const row = (id: number, qr: string | null, room: string | null, tag: string | null, categoryId = 3): ItemRow => ({
  id,
  name: `Položka ${id}`,
  asset_tag: tag,
  qr_code: qr,
  quantity: 1,
  category_id: categoryId,
  label_printed_at: null,
  equipment_categories: { name: "Nábytek" },
  equipment_rooms: room ? { name: room } : null,
});
const post = (handler: typeof printItems, body: unknown) =>
  handler(new Request("http://x/api", { method: "POST", body: JSON.stringify(body) }) as never);

beforeEach(() => {
  vi.stubEnv("EQUIPMENT_QR_BASE_URL", "https://app.example.cz");
  vi.stubEnv("AUTH_URL", "");
  currentUser = MANAGER;
  items = [row(1, "111", "Sklad", "100002"), row(2, null, "Sklad", "100001"), row(3, "333", "Recepce", "100003")];
  itemsUpdateMany.mockClear();
  roomsUpdateMany.mockClear();
  audit.mockClear();
  buildItems.mockClear();
  buildOther.mockClear();
});

describe("POST /api/equipment/labels — PDF bez vedlejších účinků", () => {
  it("vrátí PDF, položky bez QR nahlásí a spočítá vytištěné štítky", async () => {
    const res = await post(printItems, { ids: [1, 2, 3], startPosition: 8 });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/pdf");
    expect(res.headers.get("x-labels-skipped")).toBe("1");
    expect(res.headers.get("x-labels-count")).toBe("2");
    expect(buildItems).toHaveBeenCalledWith(expect.any(Array), expect.objectContaining({ startPosition: 8 }));
    expect(itemsUpdateMany).not.toHaveBeenCalled();
  });

  it("pozice mimo arch → 400", async () => {
    const res = await post(printItems, { ids: [1], startPosition: 25 });
    expect(res.status).toBe(400);
  });

  it("výběr bez jediného QR kódu → 400", async () => {
    items = [row(2, null, "Sklad", "100001")];
    const res = await post(printItems, { ids: [2] });
    expect(res.status).toBe(400);
  });
});

describe("PDF štítků — velké dávky a adresa aplikace", () => {
  it("500 štítků: hlavičky odpovědi zůstanou krátké (žádný seznam ID — proxy by je odmítla)", async () => {
    items = Array.from({ length: 500 }, (_, i) => row(1000 + i, String(900000000000 + i), "Sklad", String(100000 + i)));
    const res = await post(printItems, { ids: items.map((i) => i.id) });
    expect(res.status).toBe(200);
    expect(res.headers.get("x-labels-count")).toBe("500");
    let headerBytes = 0;
    res.headers.forEach((value, key) => {
      headerBytes += key.length + value.length;
    });
    expect(headerBytes).toBeLessThan(300);
  });

  it("bez adresy aplikace se štítky netisknou (QR by nebyl odkaz) — položky i místnosti", async () => {
    vi.stubEnv("EQUIPMENT_QR_BASE_URL", "");
    vi.stubEnv("AUTH_URL", "http://localhost:3000");
    const params = { params: Promise.resolve({ id: "1" }) };
    const get = (handler: typeof printItem) =>
      handler(Object.assign(new Request("http://x/api"), { nextUrl: new URL("http://x/api") }) as never, params);

    const responses = [
      await post(printItems, { ids: [1] }),
      await post(printRooms, { ids: [7] }),
      await get(printItem),
      await get(printRoom),
    ];
    for (const res of responses) {
      expect(res.status).toBe(503);
      await expect(res.json()).resolves.toMatchObject({ error: expect.stringMatching(/adresu/) });
    }
    expect(buildItems).not.toHaveBeenCalled();
    expect(buildOther).not.toHaveBeenCalled();
  });
});

describe("POST /api/equipment/labels/confirm — potvrzení vytištění", () => {
  it("zapíše datum tisku jen položkám s QR a audit v téže transakci", async () => {
    const res = await post(confirm, { kind: "item", ids: [1, 2, 3], printed: true });
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ updated: 2, skipped: 1 });
    expect(itemsUpdateMany).toHaveBeenCalledWith({
      where: { id: { in: [1, 3] } },
      data: { label_printed_at: expect.any(Date) },
    });
    expect(audit).toHaveBeenCalledWith(expect.objectContaining({ action: "labels_printed" }), tx);
  });

  it("„nevytištěno“ datum smaže", async () => {
    await post(confirm, { kind: "item", ids: [1], printed: false });
    expect(itemsUpdateMany).toHaveBeenCalledWith({ where: { id: { in: [1] } }, data: { label_printed_at: null } });
    expect(audit).toHaveBeenCalledWith(expect.objectContaining({ action: "labels_unprinted" }), tx);
  });

  it("bez práva zápisu do některé skupiny → 403 a nic se nezapíše", async () => {
    currentUser = RESPONSIBLE;
    items = [row(1, "111", "Sklad", "100002"), row(5, "555", "Sklad", "100005", 99)];
    const res = await post(confirm, { kind: "item", ids: [1, 5], printed: true });
    expect(res.status).toBe(403);
    expect(itemsUpdateMany).not.toHaveBeenCalled();
  });

  it("místnosti potvrzuje jen správa evidence", async () => {
    currentUser = RESPONSIBLE;
    const res = await post(confirm, { kind: "room", ids: [7], printed: true });
    expect(res.status).toBe(403);
    expect(roomsUpdateMany).not.toHaveBeenCalled();
  });

  it("neznámý druh → 400", async () => {
    const res = await post(confirm, { kind: "pool", ids: [1] });
    expect(res.status).toBe(400);
  });
});
