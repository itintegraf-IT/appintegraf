import type { AuditAction, Prisma } from "@prisma/client";
import { toDisplayUserOrNull, type ProjektyUserRow } from "@/lib/projekty/user-display";

/**
 * Where podmínka pro audit záznamy jedné karty.
 *
 * Audit log nemá denormalizovaný cardId — vazba na kartu se skládá ze tří tvarů entityId:
 * - `cardId` samotné (entityType Card),
 * - `${cardId}:${x}` — kompozitní klíče join modelů CardMember/CardLabel (viz extractId
 *   v lib/projekty/prisma.ts),
 * - vlastní cuid dětí (Checklist/ChecklistItem/Note/Attachment) — dodávané přes `childIds`.
 */
export function buildAuditWhere(cardId: string, childIds: string[]): Prisma.AuditLogWhereInput {
  return {
    OR: [
      { entityId: { in: [cardId, ...childIds] } },
      { entityId: { startsWith: `${cardId}:` } },
    ],
  };
}

export type AuditFeedRow = {
  id: string;
  userId: number | null;
  user: ProjektyUserRow | null;
  action: AuditAction;
  entityType: string;
  entityId: string;
  diff: unknown;
  createdAt: Date;
};

/** Převod DB řádku na kontrakt CardActivityFeed ({ user: { name, email } | null }). */
export function mapAuditEntry(row: AuditFeedRow) {
  const user = toDisplayUserOrNull(row.user);
  return {
    id: row.id,
    userId: row.userId,
    user: user ? { name: user.name || null, email: user.email } : null,
    action: row.action,
    entityType: row.entityType,
    entityId: row.entityId,
    diff: row.diff,
    createdAt: row.createdAt,
  };
}
