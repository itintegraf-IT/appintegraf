import { NextRequest, NextResponse } from "next/server";
import { withApiError } from "@/lib/projekty/api-utils";
import { requireSession } from "@/lib/projekty/session";
import { prisma } from "@/lib/projekty/prisma";
import { AppError } from "@/lib/projekty/errors";
import { canViewCard } from "@/lib/projekty/rbac";
import { loadCardForRBAC } from "@/lib/projekty/board-rbac";
import { projektyUserSelect } from "@/lib/projekty/user-display";
import { buildAuditWhere, mapAuditEntry } from "@/lib/projekty/audit-feed";

export const GET = withApiError(async (req: NextRequest) => {
  const user = await requireSession();
  const url = new URL(req.url);
  const cardId = url.searchParams.get("cardId");
  if (!cardId) throw new AppError("VALIDATION", "cardId je povinné.");
  const card = await loadCardForRBAC(cardId);
  if (!canViewCard(user, card)) throw new AppError("FORBIDDEN", "Nemáš přístup k této kartě.");

  // Vazba dětí na kartu je jen v živých řádcích — audit záznamy už smazaných
  // checklistů/komentářů/příloh se proto nedohledají (limitace v1; v2 by chtěla
  // denormalizovaný cardId sloupec v projekty_audit_log).
  const [checklists, checklistItems, notes, attachments] = await Promise.all([
    prisma.checklist.findMany({ where: { cardId }, select: { id: true } }),
    prisma.checklistItem.findMany({ where: { checklist: { cardId } }, select: { id: true } }),
    prisma.note.findMany({ where: { parentType: "CARD", parentId: cardId }, select: { id: true } }),
    prisma.attachment.findMany({ where: { parentType: "CARD", parentId: cardId }, select: { id: true } }),
  ]);
  const childIds = [...checklists, ...checklistItems, ...notes, ...attachments].map((r) => r.id);

  const rows = await prisma.auditLog.findMany({
    where: buildAuditWhere(cardId, childIds),
    include: { user: { select: projektyUserSelect } },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return NextResponse.json({ entries: rows.map(mapAuditEntry) });
});
