import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { withApiError, getPrismaAudited } from "@/lib/projekty/api-utils";
import { requireSession } from "@/lib/projekty/session";
import { AppError } from "@/lib/projekty/errors";
import { canEditCard } from "@/lib/projekty/rbac";
import { loadBoardForRBAC } from "@/lib/projekty/board-rbac";
import { prisma } from "@/lib/projekty/prisma";
import { logger } from "@/lib/projekty/logger";
import { PromotePersonalTodoSchema } from "@/lib/projekty/validators/personal-todo";
import { between } from "@/lib/projekty/position";
import { generateCardNumber } from "@/lib/projekty/card-number";

const MAX_RETRIES = 5;

type Params = { params: Promise<{ id: string }> };

export const POST = withApiError(async (req: Request, { params }: Params) => {
  const user = await requireSession();
  const { id } = await params;

  // Ownership check (NOT_FOUND kvůli cross-user privacy)
  const todo = await prisma.personalTodo.findUnique({ where: { id } });
  if (!todo || todo.ownerId !== user.id) {
    throw new AppError("NOT_FOUND", "Úkol nenalezen.");
  }
  if (todo.archivedAt) {
    throw new AppError("VALIDATION", "Úkol už byl přesunut na kartu.");
  }

  const body: unknown = await req.json();
  const parsed = PromotePersonalTodoSchema.safeParse(body);
  if (!parsed.success) {
    throw new AppError("VALIDATION", parsed.error.issues[0]?.message ?? "Validace selhala.");
  }

  // Vytvoření karty je operace na úrovni karty → canEditCard (povoluje i board MEMBER),
  // konzistentní s /api/projekty/lists/[id]/cards a s nabídkou boardů na /projekty/todo.
  const board = await loadBoardForRBAC(parsed.data.boardId);
  if (!canEditCard(user, { id: "new", boardId: board.id, board })) {
    throw new AppError("FORBIDDEN", "Nemáš oprávnění přidat kartu do tohoto boardu.");
  }

  // List musí patřit boardu a nesmí být archivovaný
  const list = await prisma.boardList.findUnique({
    where: { id: parsed.data.listId },
    select: { id: true, boardId: true, archived: true },
  });
  if (!list || list.boardId !== board.id) {
    throw new AppError("VALIDATION", "Sloupec není ve vybraném boardu.");
  }
  if (list.archived) {
    throw new AppError("VALIDATION", "Nelze přidat kartu do archivovaného sloupce.");
  }

  // Position: append na konec listu
  const lastCard = await prisma.card.findFirst({
    where: { listId: list.id, archived: false },
    orderBy: { position: "desc" },
    select: { position: true },
  });
  const position = between(lastCard?.position ?? null, null);

  // Atomická transakce: číslo karty + vytvoření karty + archivace úkolu.
  // Retry na P2002 (Card.number race) — stejný pattern jako lists/[id]/cards/route.ts.
  const audited = getPrismaAudited(user.id);
  let card;
  let lastErr: unknown = null;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      card = await audited.$transaction(async (tx) => {
        const number = await generateCardNumber(new Date(), tx);
        const newCard = await tx.card.create({
          data: {
            number,
            listId: list.id,
            boardId: board.id,
            title: todo.title,
            description: todo.description ?? null,
            dueDate: todo.dueDate,
            position,
          },
        });
        // Atomická archivace: guard archivedAt=null uvnitř transakce brání dvojímu promote
        // (souběžný request → 0 řádků → rollback této karty místo duplicitní/osiřelé karty).
        const res = await tx.personalTodo.updateMany({
          where: { id: todo.id, archivedAt: null },
          data: { archivedAt: new Date(), promotedToCardId: newCard.id },
        });
        if (res.count === 0) {
          throw new AppError("VALIDATION", "Úkol už byl přesunut na kartu.");
        }
        return newCard;
      });
      break;
    } catch (err) {
      lastErr = err;
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === "P2002" &&
        attempt < MAX_RETRIES
      ) {
        logger.warn("[promote] P2002 on card.number, retrying", { attempt });
        continue;
      }
      throw err;
    }
  }

  if (!card) {
    logger.error("[promote] card create failed after retries", { err: String(lastErr) });
    throw new AppError("INTERNAL", "Vytvoření karty selhalo. Zkus to znovu.");
  }

  return NextResponse.json({ card }, { status: 201 });
});
