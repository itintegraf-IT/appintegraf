import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { EQUIPMENT_ITEM_STATUS } from "@/lib/equipment-status";
import {
  canManageRegister,
  canReadEquipment,
  canWriteEquipment,
  getAccessibleCategoryIds,
} from "@/lib/equipment/access";
import {
  allocateAssetTags,
  AssetNumberingNotConfiguredError,
  isRetryableAllocationError,
  uniqueConstraintIndex,
} from "@/lib/equipment/asset-number";
import { logEquipmentAuditSafe } from "@/lib/equipment/audit";
import { validateNewItemInput } from "@/lib/equipment/new-item-validation";
import { generateUniqueEqQrCode } from "@/lib/equipment/qr";
import { claimPoolCodeForNewItem, PoolCodeError } from "@/lib/equipment/qr-pool";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }

  const userId = parseInt(session.user.id, 10);
  if (!(await canReadEquipment(userId))) {
    return NextResponse.json({ error: "Nemáte oprávnění" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const scope = searchParams.get("scope") ?? "all";
  const q = (searchParams.get("q") ?? "").trim();
  const categoryId = searchParams.get("category_id");
  const roomId = searchParams.get("room_id");
  const status = searchParams.get("status");

  const accessible = await getAccessibleCategoryIds(userId);
  const categoryFilter =
    categoryId && Number.isFinite(parseInt(categoryId, 10))
      ? parseInt(categoryId, 10)
      : null;

  if (scope === "mine") {
    const items = await prisma.equipment_assignments.findMany({
      where: { user_id: userId, returned_at: null },
      include: {
        equipment_items: {
          include: {
            equipment_categories: { select: { name: true } },
            equipment_rooms: { select: { id: true, name: true, code: true } },
          },
        },
      },
      orderBy: { assigned_at: "desc" },
    });
    type AssignmentRow = (typeof items)[number];
    const equipment = items.map((a: AssignmentRow) => ({
      ...a.equipment_items,
      assignment_id: a.id,
    }));
    return NextResponse.json({ equipment });
  }

  const where: Record<string, unknown> = {};
  if (accessible !== null) {
    where.category_id = { in: accessible };
  }
  if (categoryFilter != null) {
    where.category_id =
      accessible === null
        ? categoryFilter
        : { in: accessible.filter((id) => id === categoryFilter) };
  }
  if (roomId === "unassigned" || roomId === "null") {
    where.room_id = null;
  } else if (roomId) {
    where.room_id = parseInt(roomId, 10);
  }
  if (status) where.status = status;
  if (q) {
    where.OR = [
      { name: { contains: q } },
      { asset_tag: { contains: q } },
      { qr_code: { contains: q } },
      { serial_number: { contains: q } },
      { brand: { contains: q } },
      { model: { contains: q } },
    ];
  }

  const items = await prisma.equipment_items.findMany({
    where,
    take: 2000,
    orderBy: { id: "desc" },
    include: {
      equipment_categories: { select: { id: true, name: true } },
      equipment_rooms: { select: { id: true, name: true, code: true } },
    },
  });
  return NextResponse.json({ equipment: items });
}

/** Inventární číslo zadané ručně už existuje (v evidenci nebo ve fondu QR). */
class ManualTagTakenError extends Error {}

/** Zařazení nové položky (nákup drobného majetku). Viz lib/equipment/new-item-validation.ts. */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }
  const userId = parseInt(session.user.id, 10);

  const body: unknown = await req.json().catch(() => null);
  const validated = validateNewItemInput(body, {
    canSetManualTag: await canManageRegister(userId),
    today: new Date(),
  });
  if (!validated.ok) {
    return NextResponse.json({ error: validated.error }, { status: 400 });
  }
  const d = validated.data;

  if (!(await canWriteEquipment(userId, d.categoryId))) {
    return NextResponse.json({ error: "Nemáte oprávnění" }, { status: 403 });
  }

  try {
    const category = await prisma.equipment_categories.findUnique({
      where: { id: d.categoryId },
      select: { is_active: true },
    });
    if (!category || category.is_active === false) {
      return NextResponse.json({ error: "Vybraná skupina neexistuje nebo není aktivní." }, { status: 400 });
    }
    if (d.roomId != null) {
      const room = await prisma.equipment_rooms.findUnique({
        where: { id: d.roomId },
        select: { is_active: true },
      });
      if (!room || !room.is_active) {
        return NextResponse.json({ error: "Vybraná místnost neexistuje nebo není aktivní." }, { status: 400 });
      }
    }
    const serials = d.serialNumbers.filter((sn): sn is string => sn !== null);
    if (serials.length > 0) {
      const taken = await prisma.equipment_items.findMany({
        where: { serial_number: { in: serials } },
        select: { serial_number: true },
      });
      if (taken.length > 0) {
        return NextResponse.json(
          { error: `Sériové číslo už existuje: ${taken.map((t) => t.serial_number).join(", ")}` },
          { status: 400 }
        );
      }
    }

    // QR kódy předem, mimo transakci (unikátnost hlídá index v DB).
    const qrCodes: string[] = [];
    if (!d.poolCode) {
      for (let i = 0; i < d.unitCount; i++) qrCodes.push(await generateUniqueEqQrCode());
    }

    const shared = {
      name: d.name,
      brand: d.brand,
      model: d.model,
      description: d.description,
      category_id: d.categoryId,
      purchase_date: d.purchaseDate,
      purchase_price: d.purchasePrice,
      supplier: d.supplier,
      invoice_number: d.invoiceNumber,
      // Stav mění jen akce (přiřazení, servis, vyřazení); nová položka je vždy skladem.
      status: EQUIPMENT_ITEM_STATUS.SKLADEM,
      room_id: d.roomId,
      warranty_until: d.warrantyUntil,
      notes: d.notes,
    };

    let created: { id: number; asset_tag: string | null; qr_code: string | null; serial_number: string | null }[] = [];
    for (let attempt = 1; ; attempt++) {
      try {
        created = await prisma.$transaction(
          async (tx) => {
            let tags: string[];
            let codes = qrCodes;
            let poolId: number | null = null;
            if (d.poolCode) {
              const claim = await claimPoolCodeForNewItem(tx, d.poolCode, userId);
              tags = [claim.asset_tag];
              codes = [claim.qr_code];
              poolId = claim.poolId;
            } else if (d.manualAssetTag) {
              const clash =
                (await tx.equipment_items.count({ where: { asset_tag: d.manualAssetTag } })) +
                (await tx.equipment_qr_pool.count({ where: { asset_tag: d.manualAssetTag } }));
              if (clash > 0) throw new ManualTagTakenError(`Inventární číslo ${d.manualAssetTag} už existuje.`);
              tags = [d.manualAssetTag];
            } else {
              // Musí být prvním příkazem transakce (zámek řady).
              tags = await allocateAssetTags(tx, d.unitCount);
            }

            const rows = [];
            for (let i = 0; i < d.unitCount; i++) {
              rows.push(
                await tx.equipment_items.create({
                  data: { ...shared, serial_number: d.serialNumbers[i], asset_tag: tags[i], qr_code: codes[i] },
                  select: { id: true, asset_tag: true, qr_code: true, serial_number: true },
                })
              );
            }
            if (poolId != null) {
              await tx.equipment_qr_pool.update({ where: { id: poolId }, data: { equipment_id: rows[0].id } });
            }
            return rows;
          },
          { maxWait: 5000, timeout: 20000 }
        );
        break;
      } catch (e) {
        if (attempt < 5 && isRetryableAllocationError(e)) continue;
        throw e;
      }
    }

    for (const row of created) {
      await logEquipmentAuditSafe({
        userId,
        action: "item_create",
        tableName: "equipment_items",
        recordId: row.id,
        detail: {
          name: d.name,
          category_id: d.categoryId,
          purchase_date: d.purchaseDate.toISOString().slice(0, 10),
          purchase_price: d.purchasePrice,
          invoice_number: d.invoiceNumber,
          supplier: d.supplier,
          room_id: d.roomId,
          asset_tag: row.asset_tag,
          qr_code: row.qr_code,
          serial_number: row.serial_number,
          numbering: d.poolCode ? "pool" : d.manualAssetTag ? "manual" : "series",
        },
      });
    }

    return NextResponse.json({
      success: true,
      id: created[0].id,
      ids: created.map((r) => r.id),
      count: created.length,
      asset_tags: created.map((r) => r.asset_tag),
      warnings: validated.warnings,
    });
  } catch (e) {
    if (e instanceof AssetNumberingNotConfiguredError) {
      return NextResponse.json(
        { error: "Číselná řada inventárních čísel není nastavená. Nastavte ji v Nastavení → Inventární čísla." },
        { status: 409 }
      );
    }
    if (e instanceof PoolCodeError || e instanceof ManualTagTakenError) {
      return NextResponse.json({ error: e.message }, { status: 400 });
    }
    if (uniqueConstraintIndex(e) === "serial_number") {
      return NextResponse.json({ error: "Sériové číslo už existuje." }, { status: 400 });
    }
    console.error("Equipment POST error:", e);
    return NextResponse.json({ error: "Chyba při vytváření vybavení" }, { status: 500 });
  }
}
