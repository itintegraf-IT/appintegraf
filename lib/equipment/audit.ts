import { prisma } from "@/lib/db";

export async function logEquipmentAudit(params: {
  userId: number;
  action: string;
  tableName?: string;
  recordId?: number;
  detail?: Record<string, unknown>;
  oldValues?: Record<string, unknown>;
}): Promise<void> {
  await prisma.audit_log.create({
    data: {
      user_id: params.userId,
      module: "equipment",
      action: params.action,
      table_name: params.tableName ?? null,
      record_id: params.recordId ?? null,
      new_values: params.detail ? JSON.stringify(params.detail) : null,
      old_values: params.oldValues ? JSON.stringify(params.oldValues) : null,
    },
  });
}

export async function logEquipmentAuditSafe(
  params: Parameters<typeof logEquipmentAudit>[0]
): Promise<void> {
  try {
    await logEquipmentAudit(params);
  } catch (e) {
    console.error("equipment audit:", e);
  }
}
