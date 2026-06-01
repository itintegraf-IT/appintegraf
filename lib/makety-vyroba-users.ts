import { prisma } from "@/lib/db";
import { hasMaketyVyrobaAccess, isAdmin } from "@/lib/auth-utils";

export type MaketyVyrobaUser = {
  id: number;
  first_name: string;
  last_name: string;
};

/** Aktivní uživatelé s úrovní „Výroba maket“ (nebo admin). */
export async function getUsersWithMaketyVyrobaAccess(): Promise<MaketyVyrobaUser[]> {
  const users = await prisma.users.findMany({
    where: { is_active: true },
    orderBy: [{ last_name: "asc" }, { first_name: "asc" }],
    select: { id: true, first_name: true, last_name: true },
  });

  const result: MaketyVyrobaUser[] = [];
  for (const u of users) {
    if (await hasMaketyVyrobaAccess(u.id)) {
      result.push(u);
    }
  }
  return result;
}

export async function userHasMaketyVyrobaRole(userId: number): Promise<boolean> {
  if (await isAdmin(userId)) return true;
  return hasMaketyVyrobaAccess(userId);
}
