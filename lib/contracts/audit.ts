import { prisma } from "@/lib/db";
import { headers } from "next/headers";

const MODULE = "contracts";

/**
 * Zápis do globálního audit_log pro modul evidence smluv.
 */
export async function logContractAudit(params: {
  userId: number;
  action: string;
  tableName: string;
  recordId: number;
  oldValues?: Record<string, unknown> | null;
  newValues?: Record<string, unknown> | null;
}): Promise<void> {
  const { userId, action, tableName, recordId, oldValues, newValues } = params;

  let ipAddress: string | null = null;
  let userAgent: string | null = null;
  try {
    const h = await headers();
    ipAddress = h.get("x-forwarded-for") ?? h.get("x-real-ip") ?? null;
    userAgent = h.get("user-agent") ?? null;
  } catch {
    // mimo request kontext
  }

  await prisma.audit_log.create({
    data: {
      user_id: userId,
      module: MODULE,
      action,
      table_name: tableName,
      record_id: recordId,
      old_values: oldValues ? JSON.stringify(oldValues) : null,
      new_values: newValues ? JSON.stringify(newValues) : null,
      ip_address: ipAddress,
      user_agent: userAgent,
    },
  });
}
