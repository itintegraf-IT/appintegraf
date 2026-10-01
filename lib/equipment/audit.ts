import { prisma, type PrismaTransactionClient } from "@/lib/db";

/** JSON pro audit: BigInt jako text (jinak by JSON.stringify vyhodil a audit by se tiše neuložil). */
function auditJson(value: Record<string, unknown>): string {
  return JSON.stringify(value, (_key, v) => (typeof v === "bigint" ? v.toString() : v));
}

/**
 * Zápis do auditu. `db` = klient transakce, když má audit vzniknout spolu se změnou
 * (nevratné operace) — selhání auditu pak změnu vrátí.
 */
export async function logEquipmentAudit(
  params: {
    userId: number;
    action: string;
    tableName?: string;
    recordId?: number;
    detail?: Record<string, unknown>;
    oldValues?: Record<string, unknown>;
  },
  db: Pick<PrismaTransactionClient, "audit_log"> = prisma
): Promise<void> {
  await db.audit_log.create({
    data: {
      user_id: params.userId,
      module: "equipment",
      action: params.action,
      table_name: params.tableName ?? null,
      record_id: params.recordId ?? null,
      new_values: params.detail ? auditJson(params.detail) : null,
      old_values: params.oldValues ? auditJson(params.oldValues) : null,
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
