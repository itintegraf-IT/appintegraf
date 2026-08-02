import { NextResponse } from "next/server";
import { withApiError, getPrismaAudited } from "@/lib/projekty/api-utils";
import { requireSession } from "@/lib/projekty/session";
import { AppError } from "@/lib/projekty/errors";
import { prisma } from "@/lib/projekty/prisma";
import { loadBoardForRBAC } from "@/lib/projekty/board-rbac";
import { canEditBoard } from "@/lib/projekty/rbac";
import { ListCreateSchema } from "@/lib/projekty/validators/board-list";
import { between } from "@/lib/projekty/position";
import { defaultListColor } from "@/lib/projekty/list-colors";

type Params = { params: Promise<{ id: string }> };

export const POST = withApiError(async (req: Request, { params }: Params) => {
  const user = await requireSession();
  const { id: boardId } = await params;

  const board = await loadBoardForRBAC(boardId);
  if (!canEditBoard(user, board)) {
    throw new AppError("FORBIDDEN", "Nemůžeš přidávat listy.");
  }

  const body: unknown = await req.json();
  const parsed = ListCreateSchema.safeParse(body);
  if (!parsed.success) {
    throw new AppError("VALIDATION", parsed.error.issues[0]?.message ?? "Validace selhala.");
  }

  // Najdi nejvyšší position v boardu, nový list jde na konec
  const last = await prisma.boardList.findFirst({
    where: { boardId, archived: false },
    orderBy: { position: "desc" },
    select: { position: true },
  });
  const position = between(last?.position ?? null, null);

  // Default color rotation based on existing non-archived list count
  const existingCount = await prisma.boardList.count({
    where: { boardId, archived: false },
  });
  const color = parsed.data.color ?? defaultListColor(existingCount).value;

  const audited = getPrismaAudited(user.id);
  const list = await audited.boardList.create({
    data: { boardId, name: parsed.data.name, position, color },
  });

  return NextResponse.json({ list }, { status: 201 });
});
