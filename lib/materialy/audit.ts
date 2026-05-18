import { prisma } from "@/lib/db";

export async function logMaterialyAudit(params: {
  userId: number;
  action: string;
  tableName: string;
  recordId?: number;
  oldValues?: Record<string, unknown>;
  newValues?: Record<string, unknown>;
}) {
  await prisma.audit_log.create({
    data: {
      user_id: params.userId,
      module: "materialy",
      action: params.action,
      table_name: params.tableName,
      record_id: params.recordId ?? null,
      old_values: params.oldValues ? JSON.stringify(params.oldValues) : null,
      new_values: params.newValues ? JSON.stringify(params.newValues) : null,
    },
  });
}

/** Audit nesmí zablokovat hlavní operaci (např. chybějící tabulka audit_log v některých DB). */
export async function logMaterialyAuditSafe(params: Parameters<typeof logMaterialyAudit>[0]) {
  try {
    await logMaterialyAudit(params);
  } catch (e) {
    console.error("materialy audit log failed:", e);
  }
}
