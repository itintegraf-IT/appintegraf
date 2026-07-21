import { NextResponse } from "next/server";
import { withApiError, getPrismaAudited } from "@/lib/projekty/api-utils";
import { requireSession } from "@/lib/projekty/session";
import { AppError } from "@/lib/projekty/errors";
import { loadCardForRBAC, loadCardForFullDetail } from "@/lib/projekty/board-rbac";
import { canViewCard, canEditCard } from "@/lib/projekty/rbac";
import { CardUpdateSchema } from "@/lib/projekty/validators/card";

type Params = { params: Promise<{ id: string }> };

export const GET = withApiError(async (_req: Request, { params }: Params) => {
  const user = await requireSession();
  const { id } = await params;

  const cardForRbac = await loadCardForRBAC(id);
  if (!canViewCard(user, cardForRbac)) {
    throw new AppError("FORBIDDEN", "Nemáš přístup k této kartě.");
  }

  const card = await loadCardForFullDetail(id);
  return NextResponse.json({ card });
});

export const PATCH = withApiError(async (req: Request, { params }: Params) => {
  const user = await requireSession();
  const { id } = await params;

  const card = await loadCardForRBAC(id);
  if (!canEditCard(user, card)) {
    throw new AppError("FORBIDDEN", "Nemůžeš editovat tuto kartu.");
  }

  const body: unknown = await req.json();
  const parsed = CardUpdateSchema.safeParse(body);
  if (!parsed.success) {
    throw new AppError("VALIDATION", parsed.error.issues[0]?.message ?? "Validace selhala.");
  }

  // Convert ISO datetime strings → Date objects
  const data: Record<string, unknown> = { ...parsed.data };
  if (parsed.data.dueDate !== undefined) {
    data.dueDate = parsed.data.dueDate ? new Date(parsed.data.dueDate) : null;
  }
  if (parsed.data.startDate !== undefined) {
    data.startDate = parsed.data.startDate ? new Date(parsed.data.startDate) : null;
  }

  const audited = getPrismaAudited(user.id);
  const updated = await audited.card.update({ where: { id }, data });

  return NextResponse.json({ card: updated });
});

export const DELETE = withApiError(async (_req: Request, { params }: Params) => {
  const user = await requireSession();
  const { id } = await params;

  const card = await loadCardForRBAC(id);
  if (!canEditCard(user, card)) {
    throw new AppError("FORBIDDEN", "Nemůžeš smazat tuto kartu.");
  }

  const audited = getPrismaAudited(user.id);
  // Note a Attachment jsou polymorfní (parentType/parentId) BEZ FK na Card, takže
  // je DB kaskáda nesmaže — musíme ručně, jinak osiří (u příloh navíc BLOB → únik úložiště).
  await audited.$transaction(async (tx) => {
    await tx.note.deleteMany({ where: { parentType: "CARD", parentId: id } });
    await tx.attachment.deleteMany({ where: { parentType: "CARD", parentId: id } });
    await tx.card.delete({ where: { id } });
  });

  return NextResponse.json({ ok: true });
});
