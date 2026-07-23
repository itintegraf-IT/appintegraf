import type { BoardRole, ParentType } from "@prisma/client";
import { AppError } from "./errors";

// Workspace-level role modulu Projekty. appintegraf nemá vlastní PM Role enum —
// roli odvozuje session adaptér z oprávnění modulu (viz lib/projekty/session.ts).
export type Role = "ADMIN" | "MEMBER" | "VIEWER";

export interface SessionUser {
  id: number;
  email: string | null;
  role: Role;
}

export type BoardForRBAC = {
  id: string;
  ownerId: number;
  members?: { userId: number; role: BoardRole }[];
};

export type CardForRBAC = {
  id: string;
  boardId: string;
  board?: BoardForRBAC;
};

export function requireRole(user: SessionUser, allowed: Role[]): void {
  if (!allowed.includes(user.role)) {
    throw new AppError("FORBIDDEN", "Nemáš oprávnění k této akci.");
  }
}

/**
 * Kontrola přístupu k parent entitě. V PM tool je momentálně jediný parent CARD.
 * Pro precise per-card check viz canViewCard / canEditCard (vyžadují card+board context).
 *
 * Tento helper používá zjednodušený režim:
 * - VIEWER smí pouze read.
 * - ADMIN i MEMBER smí read i write (nezávisle na board membership!).
 *
 * Pro production: volat canViewCard / canEditCard místo canAccessParent
 * jakmile máš loaded card s `include: { list: { include: { board: { include: { members: true } } } } }`.
 */
export function canAccessParent(
  user: SessionUser,
  _parentType: ParentType,
  _parentId: string,
  mode: "read" | "write" = "read",
): Promise<boolean> {
  if (user.role === "ADMIN") return Promise.resolve(true);
  if (user.role === "VIEWER") return Promise.resolve(mode === "read");
  return Promise.resolve(true);
}

/**
 * Workspace-level admin má vše. MEMBER může editovat board, kde je owner
 * nebo board ADMIN. VIEWER má read-only všude.
 */
export function canEditBoard(user: SessionUser, board: BoardForRBAC): boolean {
  if (user.role === "ADMIN") return true;
  if (user.role === "VIEWER") return false;
  if (board.ownerId === user.id) return true;
  const member = board.members?.find((m) => m.userId === user.id);
  return member?.role === "ADMIN";
}

/**
 * Read access na board: owner, jakýkoliv member, nebo workspace ADMIN.
 */
export function canViewBoard(user: SessionUser, board: BoardForRBAC): boolean {
  if (user.role === "ADMIN") return true;
  if (board.ownerId === user.id) return true;
  return Boolean(board.members?.some((m) => m.userId === user.id));
}

/**
 * Edit karty: workspace admin, board owner, board ADMIN nebo MEMBER.
 * OBSERVER může jen komentovat (řeší se mimo tento helper — pro komentáře canViewCard).
 * VIEWER (workspace-level) nikdy.
 */
export function canEditCard(user: SessionUser, card: CardForRBAC): boolean {
  if (user.role === "ADMIN") return true;
  if (user.role === "VIEWER") return false;
  if (!card.board) return false;
  if (card.board.ownerId === user.id) return true;
  const member = card.board.members?.find((m) => m.userId === user.id);
  return member?.role === "ADMIN" || member?.role === "MEMBER";
}

export function canViewCard(user: SessionUser, card: CardForRBAC): boolean {
  if (user.role === "ADMIN") return true;
  if (!card.board) return false;
  return canViewBoard(user, card.board);
}

/**
 * Smazat board: jen workspace admin nebo board owner.
 * VIEWER (read-only) nesmí mazat nic — ani vlastní board (konzistentní s canEditBoard/canEditCard).
 */
export function canDeleteBoard(user: SessionUser, board: BoardForRBAC): boolean {
  if (user.role === "ADMIN") return true;
  if (user.role === "VIEWER") return false;
  return board.ownerId === user.id;
}
