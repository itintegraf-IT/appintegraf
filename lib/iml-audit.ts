import { prisma } from "@/lib/db";
import { headers } from "next/headers";

const IML_MODULE = "iml";

type AuditAction = "create" | "update" | "delete";

/**
 * Zaloguje akci modulu IML do globálního audit_log.
 * Používá se pro customers, products, orders, order_items.
 */
export async function logImlAudit(params: {
  userId: number;
  action: AuditAction;
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
    // headers() může selhat mimo request context
  }

  const oldStr = oldValues ? JSON.stringify(sanitizeForAudit(oldValues)) : null;
  const newStr = newValues ? JSON.stringify(sanitizeForAudit(newValues)) : null;

  await prisma.audit_log.create({
    data: {
      user_id: userId,
      module: IML_MODULE,
      action: `${action}:${tableName}`,
      table_name: tableName,
      record_id: recordId,
      old_values: oldStr,
      new_values: newStr,
      ip_address: ipAddress,
      user_agent: userAgent,
    },
  });
}

/** Odstraní BLOB a citlivá data z objektu před zápisem do audit logu */
function sanitizeForAudit(obj: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const skipKeys = ["image_data", "pdf_data", "password"];
  for (const [k, v] of Object.entries(obj)) {
    if (skipKeys.some((s: string) => k.toLowerCase().includes(s))) continue;
    if (v instanceof Buffer || v instanceof Uint8Array) continue;
    out[k] = v;
  }
  return out;
}
