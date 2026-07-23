import { NextResponse } from "next/server";
import { withApiError, getPrismaAudited } from "@/lib/projekty/api-utils";
import { requireSession } from "@/lib/projekty/session";
import { AppError } from "@/lib/projekty/errors";
import { prisma } from "@/lib/projekty/prisma";
import { loadCardForRBAC } from "@/lib/projekty/board-rbac";
import { canEditCard } from "@/lib/projekty/rbac";
import { CardLabelToggleSchema } from "@/lib/projekty/validators/card";

type Params = { params: Promise<{ id: string }> };

export const POST = withApiError(async (req: Request, { params }: Params) => {
  const user = await requireSession();
  const { id: cardId } = await params;

  const card = await loadCardForRBAC(cardId);
  if (!canEditCard(user, card)) {
    throw new AppError("FORBIDDEN", "Nemůžeš měnit labely karty.");
  }

  const body: unknown = await req.json();
  const parsed = CardLabelToggleSchema.safeParse(body);
  if (!parsed.success) {
    throw new AppError("VALIDATION", parsed.error.issues[0]?.message ?? "Validace selhala.");
  }

  // Label musí patřit ke stejnému boardu
  const label = await prisma.label.findUnique({
    where: { id: parsed.data.labelId },
    select: { id: true, boardId: true, name: true, color: true },
  });
  if (!label) throw new AppError("NOT_FOUND", "Label nenalezen.");
  if (label.boardId !== card.boardId) {
    throw new AppError("VALIDATION", "Label není z tohoto boardu.");
  }

  const existing = await prisma.cardLabel.findUnique({
    where: { cardId_labelId: { cardId, labelId: label.id } },
    select: { cardId: true },
  });

  const audited = getPrismaAudited(user.id);
  if (existing) {
    await audited.cardLabel.delete({
      where: { cardId_labelId: { cardId, labelId: label.id } },
    });
    return NextResponse.json({ removed: true, label });
  }
  await audited.cardLabel.create({ data: { cardId, labelId: label.id } });
  return NextResponse.json({ added: true, label });
});
