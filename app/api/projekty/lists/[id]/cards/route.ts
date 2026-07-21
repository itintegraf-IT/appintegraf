import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { withApiError, getPrismaAudited } from "@/lib/projekty/api-utils";
import { requireSession } from "@/lib/projekty/session";
import { AppError } from "@/lib/projekty/errors";
import { prisma } from "@/lib/projekty/prisma";
import { logger } from "@/lib/projekty/logger";
import { loadBoardForRBAC } from "@/lib/projekty/board-rbac";
import { canEditCard } from "@/lib/projekty/rbac";
import { CardCreateSchema } from "@/lib/projekty/validators/card";
import { between } from "@/lib/projekty/position";
import { generateCardNumber } from "@/lib/projekty/card-number";

const MAX_RETRIES = 5;

type Params = { params: Promise<{ id: string }> };

export const POST = withApiError(async (req: Request, { params }: Params) => {
  const user = await requireSession();
  const { id: listId } = await params;

  const list = await prisma.boardList.findUnique({
    where: { id: listId },
    select: { id: true, boardId: true, archived: true },
  });
  if (!list) throw new AppError("NOT_FOUND", "List nenalezen.");
  if (list.archived) {
    throw new AppError("VALIDATION", "Nelze přidat kartu do archivovaného sloupce.");
  }

  const board = await loadBoardForRBAC(list.boardId);
  // canEditCard expects card-shape input; use synthetic card for permission check
  if (!canEditCard(user, { id: "new", boardId: list.boardId, board })) {
    throw new AppError("FORBIDDEN", "Nemůžeš přidávat karty.");
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    throw new AppError("VALIDATION", "Tělo požadavku musí být validní JSON.");
  }
  const parsed = CardCreateSchema.safeParse(body);
  if (!parsed.success) {
    throw new AppError("VALIDATION", parsed.error.issues[0]?.message ?? "Validace selhala.");
  }

  // Position: append na konec listu
  const lastCard = await prisma.card.findFirst({
    where: { listId, archived: false },
    orderBy: { position: "desc" },
    select: { position: true },
  });
  const position = between(lastCard?.position ?? null, null);

  // Atomic transaction — number generation + card create.
  // Retry on P2002 (Card.number unique constraint): paralelní requesty mohou
  // vygenerovat stejné číslo přes findFirst race window. Retry refresh re-čte
  // sequence a vygeneruje další.
  const audited = getPrismaAudited(user.id);
  let card;
  let lastErr: unknown = null;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      card = await audited.$transaction(async (tx) => {
        const number = await generateCardNumber(new Date(), tx);
        return tx.card.create({
          data: {
            number,
            listId,
            boardId: list.boardId,
            title: parsed.data.title,
            position,
          },
        });
      });
      break;
    } catch (err) {
      lastErr = err;
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === "P2002" &&
        attempt < MAX_RETRIES
      ) {
        logger.warn("[cards] P2002 on card.number, retrying", { attempt });
        continue;
      }
      throw err;
    }
  }
  if (!card) {
    logger.error("[cards] card create failed after retries", { err: String(lastErr) });
    throw new AppError("INTERNAL", "Vytvoření karty selhalo. Zkus to znovu.");
  }

  return NextResponse.json({ card }, { status: 201 });
});
