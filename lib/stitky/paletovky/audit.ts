import { prisma } from "@/lib/db";

export async function logPaletovkaAudit(params: {
  userId: number;
  action: string;
  recordId: number;
  tableName?: "stitky_paletovky" | "stitky_paletovka_templates";
  detail?: Record<string, unknown>;
}): Promise<void> {
  await prisma.audit_log.create({
    data: {
      user_id: params.userId,
      module: "stitky",
      action: params.action,
      table_name: params.tableName ?? "stitky_paletovky",
      record_id: params.recordId,
      new_values: params.detail ? JSON.stringify(params.detail) : null,
    },
  });
}
