import { NextResponse } from "next/server";
import { withApiError, getPrismaAudited } from "@/lib/projekty/api-utils";
import { requireSession } from "@/lib/projekty/session";
import { prisma } from "@/lib/projekty/prisma";
import { AppError } from "@/lib/projekty/errors";
import { BoardCreateSchema } from "@/lib/projekty/validators/board";
import { DEFAULT_WORKSPACE_ID } from "@/lib/projekty/constants";

// GET /api/boards — seznam boardů, kde jsem owner nebo member (ADMIN vidí vše)
export const GET = withApiError(async () => {
  const user = await requireSession();

  const boards = await prisma.board.findMany({
    where: {
      archived: false,
      ...(user.role === "ADMIN"
        ? {}
        : {
            OR: [
              { ownerId: user.id },
              { members: { some: { userId: user.id } } },
            ],
          }),
    },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      name: true,
      description: true,
      background: true,
      ownerId: true,
      createdAt: true,
      updatedAt: true,
      _count: { select: { lists: true } },
    },
  });

  return NextResponse.json({ boards });
});

// POST /api/boards — create board s 3 default lists
export const POST = withApiError(async (req: Request) => {
  const user = await requireSession();
  if (user.role === "VIEWER") {
    throw new AppError("FORBIDDEN", "VIEWER nemůže vytvářet boardy.");
  }

  const body: unknown = await req.json();
  const parsed = BoardCreateSchema.safeParse(body);
  if (!parsed.success) {
    throw new AppError("VALIDATION", parsed.error.issues[0]?.message ?? "Validace selhala.");
  }

  const { name, description, background } = parsed.data;
  const audited = getPrismaAudited(user.id);

  const board = await audited.$transaction(async (tx) => {
    const created = await tx.board.create({
      data: {
        workspaceId: DEFAULT_WORKSPACE_ID,
        name,
        description: description ?? null,
        background: background ?? null,
        ownerId: user.id,
      },
    });

    await tx.boardList.createMany({
      data: [
        { boardId: created.id, name: "Todo", position: 1024 },
        { boardId: created.id, name: "Doing", position: 2048 },
        { boardId: created.id, name: "Done", position: 3072 },
      ],
    });

    return created;
  });

  return NextResponse.json({ board }, { status: 201 });
});
