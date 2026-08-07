import { randomUUID } from "crypto";
import { prisma } from "@/lib/db";
import { logEquipmentAuditSafe } from "@/lib/equipment/audit";
import { generateUniqueAssetTag, generateUniqueEqQrCode } from "@/lib/equipment/qr";

export async function generateQrPoolBatch(params: {
  count: number;
  userId: number;
  notes?: string | null;
}): Promise<{ batchId: string; codes: { id: number; qr_code: string; asset_tag: string }[] }> {
  const count = Math.min(Math.max(1, Math.floor(params.count)), 500);
  const batchId = randomUUID().replace(/-/g, "").slice(0, 16);

  const codes: { id: number; qr_code: string; asset_tag: string }[] = [];
  for (let i = 0; i < count; i++) {
    const qr_code = await generateUniqueEqQrCode();
    const asset_tag = await generateUniqueAssetTag();
    const row = await prisma.equipment_qr_pool.create({
      data: {
        qr_code,
        asset_tag,
        status: "available",
        batch_id: batchId,
        created_by: params.userId,
        notes: params.notes?.trim() || null,
      },
      select: { id: true, qr_code: true, asset_tag: true },
    });
    codes.push(row);
  }

  await logEquipmentAuditSafe({
    userId: params.userId,
    action: "qr_pool_generate",
    tableName: "equipment_qr_pool",
    detail: { batchId, count: codes.length },
  });

  return { batchId, codes };
}

export async function assignQrFromPool(params: {
  qrCode: string;
  equipmentId: number;
  userId: number;
}): Promise<{ asset_tag: string; qr_code: string }> {
  const pool = await prisma.equipment_qr_pool.findFirst({
    where: {
      OR: [{ qr_code: params.qrCode }, { asset_tag: params.qrCode }],
    },
  });
  if (!pool) throw new Error("QR kód není ve fondu");
  if (pool.status === "void") throw new Error("QR kód je znehodnocený");
  if (pool.status === "assigned") throw new Error("QR kód je už přiřazený");

  const item = await prisma.equipment_items.findUnique({
    where: { id: params.equipmentId },
    select: { id: true, qr_code: true },
  });
  if (!item) throw new Error("Položka nenalezena");
  if (item.qr_code) throw new Error("Položka už má přiřazený QR kód");

  await prisma.$transaction(async (tx) => {
    await tx.equipment_items.update({
      where: { id: params.equipmentId },
      data: {
        qr_code: pool.qr_code,
        asset_tag: pool.asset_tag,
        updated_at: new Date(),
      },
    });
    await tx.equipment_qr_pool.update({
      where: { id: pool.id },
      data: {
        status: "assigned",
        equipment_id: params.equipmentId,
        assigned_at: new Date(),
        assigned_by: params.userId,
      },
    });
  });

  await logEquipmentAuditSafe({
    userId: params.userId,
    action: "qr_assign",
    tableName: "equipment_qr_pool",
    recordId: pool.id,
    detail: {
      equipmentId: params.equipmentId,
      qr_code: pool.qr_code,
      asset_tag: pool.asset_tag,
    },
  });

  return { asset_tag: pool.asset_tag, qr_code: pool.qr_code };
}

export async function voidQrPoolCode(params: {
  id: number;
  userId: number;
}): Promise<void> {
  const pool = await prisma.equipment_qr_pool.findUnique({ where: { id: params.id } });
  if (!pool) throw new Error("Kód nenalezen");
  if (pool.status === "assigned") throw new Error("Nelze znehodnotit přiřazený kód");

  await prisma.equipment_qr_pool.update({
    where: { id: params.id },
    data: { status: "void" },
  });

  await logEquipmentAuditSafe({
    userId: params.userId,
    action: "qr_void",
    tableName: "equipment_qr_pool",
    recordId: params.id,
  });
}
