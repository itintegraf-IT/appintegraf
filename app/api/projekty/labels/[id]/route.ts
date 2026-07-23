import { NextResponse } from "next/server";
import { withApiError, getPrismaAudited } from "@/lib/projekty/api-utils";
import { requireSession } from "@/lib/projekty/session";
import { AppError } from "@/lib/projekty/errors";
import { prisma } from "@/lib/projekty/prisma";
import { loadBoardForRBAC } from "@/lib/projekty/board-rbac";
import { canEditBoard } from "@/lib/projekty/rbac";
import { LabelUpdateSchema } from "@/lib/projekty/validators/label";

type Params = { params: Promise<{ id: string }> };

async function loadLabelWithBoard(labelId: string) {
  const label = await prisma.label.findUnique({ where: { id: labelId } });
  if (!label) throw new AppError("NOT_FOUND", "Label nenalezen.");
  const board = await loadBoardForRBAC(label.boardId);
  return { label, board };
}

export const PATCH = withApiError(async (req: Request, { params }: Params) => {
  const user = await requireSession();
  const { id } = await params;
  const { label, board } = await loadLabelWithBoard(id);
  if (!canEditBoard(user, board)) {
    throw new AppError("FORBIDDEN", "Nemůžeš měnit labely.");
  }

  const body: unknown = await req.json();
  const parsed = LabelUpdateSchema.safeParse(body);
  if (!parsed.success) {
    throw new AppError("VALIDATION", parsed.error.issues[0]?.message ?? "Validace selhala.");
  }

  const audited = getPrismaAudited(user.id);
  const updated = await audited.label.update({ where: { id: label.id }, data: parsed.data });
  return NextResponse.json({ label: updated });
});

export const DELETE = withApiError(async (_req: Request, { params }: Params) => {
  const user = await requireSession();
  const { id } = await params;
  const { label, board } = await loadLabelWithBoard(id);
  if (!canEditBoard(user, board)) {
    throw new AppError("FORBIDDEN", "Nemůžeš mazat labely.");
  }

  const audited = getPrismaAudited(user.id);
  await audited.label.delete({ where: { id: label.id } });
  return NextResponse.json({ ok: true });
});
