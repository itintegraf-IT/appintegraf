import { NextResponse } from "next/server";
import { withApiError, getPrismaAudited } from "@/lib/projekty/api-utils";
import { requireSession } from "@/lib/projekty/session";
import { AppError } from "@/lib/projekty/errors";
import { prisma } from "@/lib/projekty/prisma";
import { loadBoardForRBAC } from "@/lib/projekty/board-rbac";
import { canEditBoard } from "@/lib/projekty/rbac";
import { BoardMemberAddSchema } from "@/lib/projekty/validators/board-member";
import { projektyUserSelect, toDisplayUser } from "@/lib/projekty/user-display";

type Params = { params: Promise<{ id: string }> };

export const POST = withApiError(async (req: Request, { params }: Params) => {
  const user = await requireSession();
  const { id: boardId } = await params;

  const board = await loadBoardForRBAC(boardId);
  if (!canEditBoard(user, board)) {
    throw new AppError("FORBIDDEN", "Nemůžeš přidávat členy do tohoto boardu.");
  }

  const body: unknown = await req.json();
  const parsed = BoardMemberAddSchema.safeParse(body);
  if (!parsed.success) {
    throw new AppError("VALIDATION", parsed.error.issues[0]?.message ?? "Validace selhala.");
  }

  // Owner už je implicitní member; nelze ho znovu přidávat
  if (parsed.data.userId === board.ownerId) {
    throw new AppError("VALIDATION", "Owner je už členem boardu.");
  }

  const target = await prisma.users.findUnique({ where: { id: parsed.data.userId }, select: { id: true } });
  if (!target) throw new AppError("NOT_FOUND", "Uživatel nenalezen.");

  const existingMember = await prisma.boardMember.findUnique({
    where: { boardId_userId: { boardId, userId: parsed.data.userId } },
    select: { userId: true },
  });
  if (existingMember) {
    throw new AppError("VALIDATION", "Uživatel už je členem tohoto boardu.");
  }

  const audited = getPrismaAudited(user.id);
  const raw = await audited.boardMember.create({
    data: { boardId, userId: parsed.data.userId, role: parsed.data.role },
    include: { user: { select: projektyUserSelect } },
  });
  const member = { ...raw, user: toDisplayUser(raw.user) };

  return NextResponse.json({ member }, { status: 201 });
});
