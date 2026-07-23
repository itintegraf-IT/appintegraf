import { NextRequest, NextResponse } from "next/server";
import { withApiError, getPrismaAudited } from "@/lib/projekty/api-utils";
import { requireSession } from "@/lib/projekty/session";
import { prisma } from "@/lib/projekty/prisma";
import { AppError } from "@/lib/projekty/errors";
import { canViewCard } from "@/lib/projekty/rbac";
import { loadCardForRBAC } from "@/lib/projekty/board-rbac";

export const DELETE = withApiError(async (_req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  const user = await requireSession();
  if (user.role === "VIEWER") throw new AppError("FORBIDDEN", "Viewer nemůže mazat.");
  const { id } = await ctx.params;
  // Nevybírat BLOB `data` — pro RBAC + autorizaci stačí metadata.
  const existing = await prisma.attachment.findUnique({
    where: { id },
    select: { id: true, parentType: true, parentId: true, uploadedBy: true },
  });
  if (!existing) throw new AppError("NOT_FOUND", "Příloha nenalezena.");
  if (existing.parentType === "CARD") {
    const card = await loadCardForRBAC(existing.parentId);
    if (!canViewCard(user, card)) throw new AppError("FORBIDDEN", "Nemáš přístup k této kartě.");
  }
  if (user.role !== "ADMIN" && existing.uploadedBy !== user.id) {
    throw new AppError("FORBIDDEN", "Můžeš mazat jen vlastní přílohy.");
  }
  const db = getPrismaAudited(user.id);
  await db.attachment.delete({ where: { id: existing.id } });
  // BLOB se maže spolu s řádkem — žádný soubor na disku k úklidu.
  return NextResponse.json({ ok: true });
});
