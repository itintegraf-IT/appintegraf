import type { crm_audit_action, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { randomBytes } from "crypto";

function cuid(): string {
  const t = Date.now().toString(36);
  const r = randomBytes(6).toString("hex");
  return `c${t}${r}`.slice(0, 25);
}

export async function writeCrmAuditLog(data: {
  user_id: number | null;
  entity_type: string;
  entity_id: string;
  action: crm_audit_action;
  diff: Record<string, unknown>;
}): Promise<void> {
  await prisma.crm_audit_log.create({
    data: {
      id: cuid(),
      user_id: data.user_id,
      entity_type: data.entity_type,
      entity_id: data.entity_id,
      action: data.action,
      diff: data.diff as Prisma.InputJsonValue,
    },
  });
}
