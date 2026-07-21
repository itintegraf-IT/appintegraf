import { NextResponse } from "next/server";
import { withApiError, getPrismaAudited } from "@/lib/projekty/api-utils";
import { requireSession } from "@/lib/projekty/session";
import { AppError } from "@/lib/projekty/errors";
import { prisma } from "@/lib/projekty/prisma";
import { canEditCard } from "@/lib/projekty/rbac";
import { loadChecklistItemForRBAC } from "@/lib/projekty/checklist-rbac";
import {
  ChecklistItemUpdateSchema,
  ChecklistItemMoveSchema,
} from "@/lib/projekty/validators/checklist";
import { between } from "@/lib/projekty/position";

type Params = { params: Promise<{ id: string }> };

export const PATCH = withApiError(async (req: Request, { params }: Params) => {
  const user = await requireSession();
  const { id } = await params;

  const { item, card } = await loadChecklistItemForRBAC(id);
  if (!canEditCard(user, card)) {
    throw new AppError("FORBIDDEN", "Nemůžeš editovat položky checklistu.");
  }

  const body: unknown = await req.json();

  // Body s afterItemId/beforeItemId → move; jinak update.
  if (
    typeof body === "object" &&
    body !== null &&
    ("afterItemId" in body || "beforeItemId" in body)
  ) {
    const moveParsed = ChecklistItemMoveSchema.safeParse(body);
    if (!moveParsed.success) {
      throw new AppError("VALIDATION", moveParsed.error.issues[0]?.message ?? "Validace selhala.");
    }
    const { afterItemId, beforeItemId } = moveParsed.data;

    const prev = afterItemId
      ? await prisma.checklistItem.findUnique({
          where: { id: afterItemId },
          select: { position: true, checklistId: true },
        })
      : null;
    const next = beforeItemId
      ? await prisma.checklistItem.findUnique({
          where: { id: beforeItemId },
          select: { position: true, checklistId: true },
        })
      : null;

    if (prev && prev.checklistId !== item.checklistId) {
      throw new AppError("VALIDATION", "afterItemId je z jiného checklistu.");
    }
    if (next && next.checklistId !== item.checklistId) {
      throw new AppError("VALIDATION", "beforeItemId je z jiného checklistu.");
    }

    const newPosition = between(prev?.position ?? null, next?.position ?? null);
    const audited = getPrismaAudited(user.id);
    await audited.checklistItem.update({ where: { id }, data: { position: newPosition } });
    return NextResponse.json({ ok: true });
  }

  const parsed = ChecklistItemUpdateSchema.safeParse(body);
  if (!parsed.success) {
    throw new AppError("VALIDATION", parsed.error.issues[0]?.message ?? "Validace selhala.");
  }

  // assigneeId (pokud zadané a non-null) musí být owner nebo člen boardu karty —
  // jinak by neexistující uživatel shodil FK (500) a ne-člen by šel přiřadit.
  if (parsed.data.assigneeId != null) {
    const board = await prisma.board.findUnique({
      where: { id: card.boardId },
      select: { ownerId: true, members: { select: { userId: true } } },
    });
    const allowed = new Set<number>([
      ...(board ? [board.ownerId] : []),
      ...(board?.members.map((m) => m.userId) ?? []),
    ]);
    if (!allowed.has(parsed.data.assigneeId)) {
      throw new AppError("VALIDATION", "Uživatel není členem boardu — přiřadit lze jen člena.");
    }
  }

  const data: Record<string, unknown> = { ...parsed.data };
  if (parsed.data.dueDate !== undefined) {
    data.dueDate = parsed.data.dueDate ? new Date(parsed.data.dueDate) : null;
  }

  const audited = getPrismaAudited(user.id);
  const updated = await audited.checklistItem.update({ where: { id }, data });

  return NextResponse.json({ item: updated });
});

export const DELETE = withApiError(async (_req: Request, { params }: Params) => {
  const user = await requireSession();
  const { id } = await params;

  const { card } = await loadChecklistItemForRBAC(id);
  if (!canEditCard(user, card)) {
    throw new AppError("FORBIDDEN", "Nemůžeš mazat položky.");
  }

  const audited = getPrismaAudited(user.id);
  await audited.checklistItem.delete({ where: { id } });

  return NextResponse.json({ ok: true });
});
