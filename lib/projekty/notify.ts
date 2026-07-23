import { prisma } from "@/lib/db";
import { logger } from "@/lib/projekty/logger";

/**
 * In-app notifikace modulu Projekty. Píše do SDÍLENÉHO appintegraf systému
 * `notifications` (zvoneček v hlavičce) — modul Projekty NEMÁ vlastní model
 * ani e-mailovou šablonu (na rozdíl od Úkolů), notifikace jsou tedy jen in-app.
 *
 * Vše je best-effort: selhání zápisu notifikace NESMÍ shodit uživatelskou akci
 * (komentář, přiřazení, změna termínu) — zaloguje se a pokračuje.
 */

const MAX_LINK = 500;

async function actorName(userId: number): Promise<string> {
  const u = await prisma.users.findUnique({
    where: { id: userId },
    select: { first_name: true, last_name: true, username: true },
  });
  if (!u) return "Uživatel";
  return `${u.first_name} ${u.last_name}`.trim() || u.username;
}

function cardLink(boardId: string, cardId: string): string {
  return `/projekty/boards/${boardId}?card=${cardId}`.slice(0, MAX_LINK);
}

/** Prostý text z (Tiptap) HTML pro náhled v notifikaci. */
export function plainPreview(content: string, max = 120): string {
  return content
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

/**
 * Board kontext karty pro notifikace: název, boardId a množina uživatelů, kteří
 * kartu SMÍ vidět (owner + členové boardu). Notifikace se musí filtrovat proti
 * `viewerIds`, jinak by náhled obsahu / název karty ze soukromého boardu unikl
 * uživateli bez přístupu (zmíněný e-mailem napříč celým appintegrafem).
 * Card nemá přímou relaci na Board → boardId + druhý dotaz.
 */
export async function cardBoardContext(
  cardId: string,
): Promise<{ boardId: string; title: string; viewerIds: Set<number> } | null> {
  const card = await prisma.card.findUnique({
    where: { id: cardId },
    select: { boardId: true, title: true },
  });
  if (!card) return null;
  const board = await prisma.board.findUnique({
    where: { id: card.boardId },
    select: { ownerId: true, members: { select: { userId: true } } },
  });
  const viewerIds = new Set<number>(
    board ? [board.ownerId, ...board.members.map((m) => m.userId)] : [],
  );
  return { boardId: card.boardId, title: card.title, viewerIds };
}

/** @zmínky v komentáři ke kartě → notifikace zmíněným (kromě autora). */
export async function notifyProjektyMentions(params: {
  mentionUserIds: number[];
  actorId: number;
  boardId: string;
  cardId: string;
  cardTitle: string;
  preview: string;
}): Promise<void> {
  try {
    const recipients = [...new Set(params.mentionUserIds)].filter((id) => id !== params.actorId);
    if (recipients.length === 0) return;
    const name = await actorName(params.actorId);
    const link = cardLink(params.boardId, params.cardId);
    const message = `${name} vás zmínil/a v kartě „${params.cardTitle}": ${params.preview}`.slice(0, 250);
    await prisma.notifications.createMany({
      data: recipients.map((uid) => ({
        user_id: uid,
        title: "Zmínka v projektu",
        message,
        type: "projekty_mention",
        link,
      })),
    });
  } catch (err) {
    logger.error("[projekty notify] zmínky selhaly", err as Error);
  }
}

/** Přiřazení uživatele ke kartě → notifikace přiřazenému (kromě sebe-přiřazení). */
export async function notifyProjektyCardAssigned(params: {
  assignedUserId: number;
  actorId: number;
  boardId: string;
  cardId: string;
  cardTitle: string;
}): Promise<void> {
  try {
    if (params.assignedUserId === params.actorId) return;
    const name = await actorName(params.actorId);
    await prisma.notifications.create({
      data: {
        user_id: params.assignedUserId,
        title: "Přiřazení ke kartě",
        message: `${name} vás přiřadil/a ke kartě „${params.cardTitle}".`.slice(0, 250),
        type: "projekty_card_assigned",
        link: cardLink(params.boardId, params.cardId),
      },
    });
  } catch (err) {
    logger.error("[projekty notify] přiřazení selhalo", err as Error);
  }
}

/** Změna termínu karty → notifikace členům karty (kromě toho, kdo změnu udělal). */
export async function notifyProjektyCardDueDateChanged(params: {
  memberUserIds: number[];
  actorId: number;
  boardId: string;
  cardId: string;
  cardTitle: string;
  dueDate: Date | null;
}): Promise<void> {
  try {
    const recipients = [...new Set(params.memberUserIds)].filter((id) => id !== params.actorId);
    if (recipients.length === 0) return;
    const name = await actorName(params.actorId);
    const dueStr = params.dueDate
      ? new Intl.DateTimeFormat("cs-CZ", { day: "numeric", month: "numeric", year: "numeric" }).format(
          params.dueDate,
        )
      : null;
    const message = (
      dueStr
        ? `${name} nastavil/a termín karty „${params.cardTitle}" na ${dueStr}.`
        : `${name} zrušil/a termín karty „${params.cardTitle}".`
    ).slice(0, 250);
    const link = cardLink(params.boardId, params.cardId);
    await prisma.notifications.createMany({
      data: recipients.map((uid) => ({
        user_id: uid,
        title: "Změna termínu",
        message,
        type: "projekty_due_changed",
        link,
      })),
    });
  } catch (err) {
    logger.error("[projekty notify] změna termínu selhala", err as Error);
  }
}
