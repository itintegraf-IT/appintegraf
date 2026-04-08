import { headers } from "next/headers";
import { prisma } from "@/lib/db";

const MODULE = "personalistika";

export async function logPersonalistikaAudit(params: {
  userId?: number | null;
  action: string;
  tableName: string;
  recordId: number;
  oldValues?: Record<string, unknown> | null;
  newValues?: Record<string, unknown> | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}): Promise<void> {
  const { userId, action, tableName, recordId, oldValues, newValues } = params;
  let ipAddress = params.ipAddress ?? null;
  let userAgent = params.userAgent ?? null;

  if (!ipAddress || !userAgent) {
    try {
      const h = await headers();
      ipAddress = ipAddress ?? h.get("x-forwarded-for") ?? h.get("x-real-ip") ?? null;
      userAgent = userAgent ?? h.get("user-agent") ?? null;
    } catch {
      // no-op outside request context
    }
  }

  await prisma.audit_log.create({
    data: {
      user_id: userId ?? null,
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
