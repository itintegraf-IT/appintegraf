import { requireCrmRead, requireCrmWrite, requireCrmAdmin } from "@/lib/crm/guards";
import { NextRequest, NextResponse } from "next/server";
import { withApiError } from "@/lib/crm/api-utils";
import { prisma } from "@/lib/db";
import { AppError } from "@/lib/crm/errors";
import { canAccessParent } from "@/lib/crm/rbac";
import { deleteAttachment } from "@/lib/crm/file-storage";

export const DELETE = withApiError(async (_req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  const user = await requireCrmRead();
  if (user.role === "VIEWER") throw new AppError("FORBIDDEN", "Viewer nemůže mazat.");
  const { id } = await ctx.params;
  const existing = await prisma.crm_attachments.findUnique({ where: { id } });
  if (!existing) throw new AppError("NOT_FOUND", "Příloha nenalezena.");
  if (user.role !== "ADMIN" && existing.uploaded_by !== user.id) {
    const ok = await canAccessParent(user, existing.parent_type, existing.parent_id, "write");
    if (!ok) throw new AppError("FORBIDDEN", "Nemáš přístup.");
  }
  await prisma.crm_attachments.delete({ where: { id: existing.id } });
  await deleteAttachment(existing.path).catch(() => {
    // file cleanup best-effort
  });
  return NextResponse.json({ ok: true });
});
