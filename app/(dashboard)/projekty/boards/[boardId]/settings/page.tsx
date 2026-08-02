import { notFound } from "next/navigation";
import { requireSession } from "@/lib/projekty/session";
import { prisma } from "@/lib/projekty/prisma";
import { canEditBoard, canDeleteBoard } from "@/lib/projekty/rbac";
import { loadBoardForRBAC } from "@/lib/projekty/board-rbac";
import { isAppError } from "@/lib/projekty/errors";
import { projektyUserSelect, toDisplayUser } from "@/lib/projekty/user-display";
import { BoardSettingsForm } from "@/components/projekty/boards/BoardSettingsForm";
import { BoardMembersManager } from "@/components/projekty/boards/BoardMembersManager";
import { BoardLabelsManager } from "@/components/projekty/boards/BoardLabelsManager";
import { BoardDangerZone } from "@/components/projekty/boards/BoardDangerZone";

type Params = Promise<{ boardId: string }>;

export default async function BoardSettingsPage({ params }: { params: Params }) {
  const user = await requireSession();
  const { boardId } = await params;

  const rbacBoard = await loadBoardForRBAC(boardId).catch((err) => {
    if (isAppError(err) && err.code === "NOT_FOUND") return null;
    throw err;
  });
  if (!rbacBoard) notFound();
  if (!canEditBoard(user, rbacBoard)) notFound();

  const [board, allUsersRaw, labels, membersRaw] = await Promise.all([
    prisma.board.findUnique({ where: { id: boardId } }),
    prisma.users.findMany({
      where: { is_active: true },
      select: projektyUserSelect,
      orderBy: { last_name: "asc" },
    }),
    prisma.label.findMany({ where: { boardId }, orderBy: { name: "asc" } }),
    prisma.boardMember.findMany({
      where: { boardId },
      include: {
        user: { select: projektyUserSelect },
      },
      orderBy: { user: { last_name: "asc" } },
    }),
  ]);
  if (!board) notFound();

  const allUsers = allUsersRaw.map(toDisplayUser);
  const members = membersRaw.map((m) => ({ ...m, user: toDisplayUser(m.user) }));

  const canDelete = canDeleteBoard(user, rbacBoard);

  return (
    <main className="container mx-auto max-w-3xl p-4 md:p-6 space-y-6">
      <h1 className="text-2xl font-semibold">Nastavení boardu</h1>
      <BoardSettingsForm board={board} />
      <BoardMembersManager
        boardId={boardId}
        members={members}
        allUsers={allUsers}
        ownerId={board.ownerId}
        currentUserId={user.id}
      />
      <BoardLabelsManager boardId={boardId} labels={labels} />
      <BoardDangerZone boardId={boardId} boardName={board.name} canDelete={canDelete} />
    </main>
  );
}
