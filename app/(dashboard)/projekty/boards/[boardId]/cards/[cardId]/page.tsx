import { notFound, redirect } from "next/navigation";
import { requireSession } from "@/lib/projekty/session";
import { canViewCard } from "@/lib/projekty/rbac";
import { loadCardForRBAC, loadCardForFullDetail } from "@/lib/projekty/board-rbac";
import { isAppError } from "@/lib/projekty/errors";
import { prisma } from "@/lib/projekty/prisma";
import { CardDetailPage } from "@/components/projekty/boards/CardDetailPage";
import type { FullCard } from "@/components/projekty/boards/CardDetailContent";

type Params = Promise<{ boardId: string; cardId: string }>;

// Plnostránkový detail karty. Kanonický deep-link zůstává
// /projekty/boards/[boardId]?card=[cardId] (side panel) — tahle stránka je
// „rozbalená" varianta pro dlouhou práci s kartou a přímé sdílení.
export default async function CardPage({ params }: { params: Params }) {
  const user = await requireSession();
  const { boardId, cardId } = await params;

  const rbacCard = await loadCardForRBAC(cardId).catch((err) => {
    if (isAppError(err) && err.code === "NOT_FOUND") return null;
    throw err;
  });
  if (!rbacCard) notFound();
  if (!canViewCard(user, rbacCard)) notFound();
  if (rbacCard.boardId !== boardId) {
    redirect(`/projekty/boards/${rbacCard.boardId}/cards/${cardId}`);
  }

  const [card, board] = await Promise.all([
    loadCardForFullDetail(cardId),
    prisma.board.findUnique({ where: { id: boardId }, select: { name: true } }),
  ]);

  // Date → ISO string (FullCard očekává stringy; RSC props musí být serializovatelné)
  const serialized = JSON.parse(JSON.stringify(card)) as FullCard;

  return (
    <CardDetailPage
      initialCard={serialized}
      boardName={board?.name ?? "Board"}
      currentUserId={user.id}
    />
  );
}
