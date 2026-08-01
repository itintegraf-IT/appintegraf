import type { Prisma } from "@prisma/client";
import type { SessionUser } from "@/lib/projekty/rbac";

/**
 * Where podmínka pro hledání karet (command palette). RBAC přes relaci
 * list.board — bez ní by hledání leakovalo titulky karet z cizích boardů.
 * Vytaženo do lib kvůli testovatelnosti (vitest node env, bez DB).
 */
export function buildCardSearchWhere(
  user: Pick<SessionUser, "id" | "role">,
  q: string,
): Prisma.CardWhereInput {
  return {
    archived: false,
    title: { contains: q },
    list: {
      board: {
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
    },
  };
}
