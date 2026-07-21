import { NextResponse } from "next/server";
import { withApiError, getPrismaAudited } from "@/lib/projekty/api-utils";
import { requireSession } from "@/lib/projekty/session";
import { AppError } from "@/lib/projekty/errors";
import { prisma } from "@/lib/projekty/prisma";
import { loadCardForRBAC } from "@/lib/projekty/board-rbac";
import { canEditCard } from "@/lib/projekty/rbac";
import { CardMemberAddSchema } from "@/lib/projekty/validators/card";
import { projektyUserSelect, toDisplayUser } from "@/lib/projekty/user-display";

type Params = { params: Promise<{ id: string }> };

export const POST = withApiError(async (req: Request, { params }: Params) => {
  const user = await requireSession();
  const { id: cardId } = await params;

  const card = await loadCardForRBAC(cardId);
  if (!canEditCard(user, card)) {
    throw new AppError("FORBIDDEN", "Nemůžeš přiřazovat členy ke kartě.");
  }

  const body: unknown = await req.json();
  const parsed = CardMemberAddSchema.safeParse(body);
  if (!parsed.success) {
    throw new AppError("VALIDATION", parsed.error.issues[0]?.message ?? "Validace selhala.");
  }

  // User must be a member of the board (or owner)
  const isBoardMember =
    card.board?.ownerId === parsed.data.userId ||
    Boolean(card.board?.members?.some((m) => m.userId === parsed.data.userId));
  if (!isBoardMember) {
    throw new AppError(
      "VALIDATION",
      "Uživatel není členem boardu — přidej ho přes nastavení boardu.",
    );
  }

  // Idempotent: pokud už je member, vrať OK
  const existing = await prisma.cardMember.findUnique({
    where: { cardId_userId: { cardId, userId: parsed.data.userId } },
    select: { userId: true },
  });
  if (existing) {
    return NextResponse.json({ ok: true, alreadyMember: true });
  }

  const audited = getPrismaAudited(user.id);
  const raw = await audited.cardMember.create({
    data: { cardId, userId: parsed.data.userId },
    include: { user: { select: projektyUserSelect } },
  });
  const member = { ...raw, user: toDisplayUser(raw.user) };

  return NextResponse.json({ member }, { status: 201 });
});
