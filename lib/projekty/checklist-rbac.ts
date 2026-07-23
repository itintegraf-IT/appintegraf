import { prisma } from "@/lib/projekty/prisma";
import { AppError } from "@/lib/projekty/errors";
import { loadCardForRBAC } from "@/lib/projekty/board-rbac";
import type { CardForRBAC } from "@/lib/projekty/rbac";

/**
 * Load checklist + parent card for RBAC. Throws NOT_FOUND if missing.
 */
export async function loadChecklistForRBAC(checklistId: string): Promise<{
  checklist: { id: string; cardId: string; name: string; position: number };
  card: CardForRBAC;
}> {
  const checklist = await prisma.checklist.findUnique({
    where: { id: checklistId },
    select: { id: true, cardId: true, name: true, position: true },
  });
  if (!checklist) throw new AppError("NOT_FOUND", "Checklist nenalezen.");
  const card = await loadCardForRBAC(checklist.cardId);
  return { checklist, card };
}

/**
 * Load checklistItem + parent checklist + parent card.
 */
export async function loadChecklistItemForRBAC(itemId: string): Promise<{
  item: {
    id: string;
    checklistId: string;
    text: string;
    done: boolean;
    position: number;
    assigneeId: number | null;
    dueDate: Date | null;
  };
  checklist: { id: string; cardId: string };
  card: CardForRBAC;
}> {
  const item = await prisma.checklistItem.findUnique({
    where: { id: itemId },
    include: {
      checklist: { select: { id: true, cardId: true } },
    },
  });
  if (!item) throw new AppError("NOT_FOUND", "Položka checklistu nenalezena.");
  const card = await loadCardForRBAC(item.checklist.cardId);
  return {
    item: {
      id: item.id,
      checklistId: item.checklistId,
      text: item.text,
      done: item.done,
      position: item.position,
      assigneeId: item.assigneeId,
      dueDate: item.dueDate,
    },
    checklist: item.checklist,
    card,
  };
}
