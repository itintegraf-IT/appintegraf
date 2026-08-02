import { NextResponse } from "next/server";
import { withApiError, getPrismaAudited } from "@/lib/projekty/api-utils";
import { requireSession } from "@/lib/projekty/session";
import { AppError } from "@/lib/projekty/errors";
import { prisma } from "@/lib/projekty/prisma";
import { loadCardForRBAC } from "@/lib/projekty/board-rbac";
import { canEditCard } from "@/lib/projekty/rbac";

type Params = { params: Promise<{ id: string; userId: string }> };

export const DELETE = withApiError(async (_req: Request, { params }: Params) => {
  const user = await requireSession();
  const { id: cardId, userId: userIdRaw } = await params;
  const userId = parseInt(userIdRaw, 10);
  if (!Number.isFinite(userId)) throw new AppError("VALIDATION", "Neplatné userId.");

  const card = await loadCardForRBAC(cardId);
  if (!canEditCard(user, card)) {
    throw new AppError("FORBIDDEN", "Nemůžeš odstranit člena z karty.");
  }

  const existing = await prisma.cardMember.findUnique({
    where: { cardId_userId: { cardId, userId } },
    select: { userId: true },
  });
  if (!existing) {
    throw new AppError("NOT_FOUND", "Tento uživatel není přiřazen k kartě.");
  }

  const audited = getPrismaAudited(user.id);
  await audited.cardMember.delete({ where: { cardId_userId: { cardId, userId } } });

  return NextResponse.json({ ok: true });
});
