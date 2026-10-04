import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { canAdministerEquipment } from "@/lib/equipment/access";
import { applyHolderPairs, applyRoomPairs, loadHolderPlan, loadRoomPlan } from "@/lib/equipment/data-prep/apply";

type Step = "rooms" | "holders";
const MAX_PAIRS = 2000;
/** Kolik položek skupiny vrátit k obchůzce (počet je vždy celý). */
const GROUP_ITEMS_LIMIT = 300;

function parseStep(raw: string): Step | null {
  return raw === "rooms" || raw === "holders" ? raw : null;
}

async function guard(): Promise<{ userId: number } | NextResponse> {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }
  const userId = parseInt(session.user.id, 10);
  if (!(await canAdministerEquipment(userId))) {
    return NextResponse.json({ error: "Nemáte oprávnění" }, { status: 403 });
  }
  return { userId };
}

async function inventoryInProgress(): Promise<boolean> {
  return (await prisma.equipment_inventories.count({ where: { status: "in_progress" } })) > 0;
}

/** Páry z požadavku: celá kladná čísla, každá položka nejvýš jednou. */
function parsePairs(raw: unknown, targetKey: "roomId" | "userId"): { itemId: number; target: number }[] | null {
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > MAX_PAIRS) return null;
  const seen = new Set<number>();
  const pairs: { itemId: number; target: number }[] = [];
  for (const entry of raw) {
    const itemId = Number((entry as Record<string, unknown>)?.itemId);
    const target = Number((entry as Record<string, unknown>)?.[targetKey]);
    if (!Number.isInteger(itemId) || itemId <= 0 || !Number.isInteger(target) || target <= 0) return null;
    if (seen.has(itemId)) return null;
    seen.add(itemId);
    pairs.push({ itemId, target });
  }
  return pairs;
}

/** Náhled kroku přípravy dat nad aktuálními daty. */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ step: string }> }) {
  const guarded = await guard();
  if (guarded instanceof NextResponse) return guarded;
  const step = parseStep((await params).step);
  if (!step) return NextResponse.json({ error: "Neznámý krok" }, { status: 404 });

  const inProgress = await inventoryInProgress();

  if (step === "rooms") {
    const { plan, itemInfo, rooms } = await loadRoomPlan(prisma);
    const toRow = (p: (typeof plan.auto)[number]) => ({
      itemId: p.itemId,
      roomId: p.roomId,
      reason: p.reason,
      location: p.location,
      assetTag: itemInfo.get(p.itemId)?.assetTag ?? null,
      itemName: itemInfo.get(p.itemId)?.name ?? "",
      roomCode: rooms.get(p.roomId)?.code ?? "",
      roomName: rooms.get(p.roomId)?.name ?? "",
    });
    return NextResponse.json({
      auto: plan.auto.map(toRow),
      suggest: plan.suggest.map(toRow),
      groups: plan.groups.map((g) => ({
        kind: g.kind,
        label: g.label,
        count: g.count,
        items: g.itemIds.slice(0, GROUP_ITEMS_LIMIT).map((id) => ({ id, ...itemInfo.get(id) })),
      })),
      skipped: plan.skipped,
      inventoryInProgress: inProgress,
    });
  }

  const { plan, itemInfo, users } = await loadHolderPlan(prisma);
  return NextResponse.json({
    rows: plan.rows.map((r) => ({
      itemId: r.itemId,
      userId: r.userId,
      kind: r.kind,
      holderText: r.holderText,
      warning: r.warning ?? null,
      assetTag: itemInfo.get(r.itemId)?.assetTag ?? null,
      itemName: itemInfo.get(r.itemId)?.name ?? "",
      userName: users.get(r.userId) ?? "",
    })),
    groups: plan.groups.map((g) => ({
      kind: g.kind,
      label: g.label,
      count: g.count,
      items: g.itemIds.slice(0, GROUP_ITEMS_LIMIT).map((id) => ({ id, ...itemInfo.get(id) })),
    })),
    skipped: plan.skipped,
    inventoryInProgress: inProgress,
  });
}

/** Provedení schválených párů kroku přípravy dat — vše v jedné transakci. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ step: string }> }) {
  const guarded = await guard();
  if (guarded instanceof NextResponse) return guarded;
  const step = parseStep((await params).step);
  if (!step) return NextResponse.json({ error: "Neznámý krok" }, { status: 404 });

  const body = (await req.json().catch(() => null)) as { pairs?: unknown } | null;
  const pairs = parsePairs(body?.pairs, step === "rooms" ? "roomId" : "userId");
  if (!pairs) return NextResponse.json({ error: "Neplatný výběr položek" }, { status: 400 });

  if (await inventoryInProgress()) {
    return NextResponse.json(
      { error: "Právě probíhá inventura — úklid dat spusťte, až skončí (změny místností by ji rozhodily)." },
      { status: 409 }
    );
  }

  try {
    const result = await prisma.$transaction(
      (tx) =>
        step === "rooms"
          ? applyRoomPairs(tx, pairs.map((p) => ({ itemId: p.itemId, roomId: p.target })), guarded.userId)
          : applyHolderPairs(tx, pairs.map((p) => ({ itemId: p.itemId, userId: p.target })), guarded.userId),
      { maxWait: 5000, timeout: 120000 }
    );
    return NextResponse.json(result);
  } catch (e) {
    console.error(`[data-prep/${step}]`, e);
    if (e instanceof Prisma.PrismaClientKnownRequestError && (e.code === "P2028" || e.code === "P2034")) {
      return NextResponse.json({ error: "Server je teď vytížený. Nic se nezměnilo — zkuste to znovu." }, { status: 503 });
    }
    return NextResponse.json({ error: "Úklid dat se nepodařil. Nic se nezměnilo." }, { status: 500 });
  }
}
