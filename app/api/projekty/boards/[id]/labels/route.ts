import { NextResponse } from "next/server";
import { withApiError, getPrismaAudited } from "@/lib/projekty/api-utils";
import { requireSession } from "@/lib/projekty/session";
import { AppError } from "@/lib/projekty/errors";
import { prisma } from "@/lib/projekty/prisma";
import { loadBoardForRBAC } from "@/lib/projekty/board-rbac";
import { canViewBoard, canEditBoard } from "@/lib/projekty/rbac";
import { LabelCreateSchema } from "@/lib/projekty/validators/label";

type Params = { params: Promise<{ id: string }> };

export const GET = withApiError(async (_req: Request, { params }: Params) => {
  const user = await requireSession();
  const { id: boardId } = await params;
  const board = await loadBoardForRBAC(boardId);
  if (!canViewBoard(user, board)) {
    throw new AppError("FORBIDDEN", "Nemáš přístup k tomuto boardu.");
  }
  const labels = await prisma.label.findMany({ where: { boardId }, orderBy: { name: "asc" } });
  return NextResponse.json({ labels });
});

export const POST = withApiError(async (req: Request, { params }: Params) => {
  const user = await requireSession();
  const { id: boardId } = await params;
  const board = await loadBoardForRBAC(boardId);
  if (!canEditBoard(user, board)) {
    throw new AppError("FORBIDDEN", "Nemůžeš vytvářet labely.");
  }

  const body: unknown = await req.json();
  const parsed = LabelCreateSchema.safeParse(body);
  if (!parsed.success) {
    throw new AppError("VALIDATION", parsed.error.issues[0]?.message ?? "Validace selhala.");
  }

  const audited = getPrismaAudited(user.id);
  const label = await audited.label.create({ data: { boardId, ...parsed.data } });
  return NextResponse.json({ label }, { status: 201 });
});
