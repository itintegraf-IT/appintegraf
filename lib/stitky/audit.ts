import { prisma } from "@/lib/db";

export async function logStitkyAudit(params: {
  userId: number;
  action: string;
  orderId: number;
  detail?: Record<string, unknown>;
}): Promise<void> {
  await prisma.audit_log.create({
    data: {
      user_id: params.userId,
      module: "stitky",
      action: params.action,
      table_name: "stitky_orders",
      record_id: params.orderId,
      new_values: params.detail ? JSON.stringify(params.detail) : null,
    },
  });
}
