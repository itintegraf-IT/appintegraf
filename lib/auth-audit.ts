import { headers } from "next/headers";
import { prisma } from "@/lib/db";

const MODULE = "auth";

export type AuthAuditAction =
  | "password_reset_requested"
  | "password_reset_completed"
  | "password_set_by_admin"
  | "admin_sent_reset_link"
  | "account_activation_sent"
  | "account_activated"
  | "password_reset_rate_limited";

export async function logAuthAudit(params: {
  userId?: number | null;
  targetUserId?: number | null;
  action: AuthAuditAction;
  details?: Record<string, unknown> | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}): Promise<void> {
  let ipAddress = params.ipAddress ?? null;
  let userAgent = params.userAgent ?? null;

  if (!ipAddress || !userAgent) {
    try {
      const h = await headers();
      ipAddress =
        ipAddress ??
        h.get("x-forwarded-for")?.split(",")[0]?.trim() ??
        h.get("x-real-ip") ??
        null;
      userAgent = userAgent ?? h.get("user-agent") ?? null;
    } catch {
      // no-op mimo request context
    }
  }

  try {
    await prisma.audit_log.create({
      data: {
        user_id: params.userId ?? null,
        module: MODULE,
        action: params.action,
        table_name: "users",
        record_id: params.targetUserId ?? null,
        new_values: params.details ? JSON.stringify(params.details) : null,
        ip_address: ipAddress,
        user_agent: userAgent,
      },
    });
  } catch (e) {
    // Audit log selhání nesmí blokovat samotnou akci
    console.error("logAuthAudit failed:", e);
  }
}

/** Jednoduché získání IP z aktuálního requestu (pro endpointy, kde není přístup k NextRequest). */
export async function getRequestIp(): Promise<string | null> {
  try {
    const h = await headers();
    return (
      h.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      h.get("x-real-ip") ??
      null
    );
  } catch {
    return null;
  }
}
