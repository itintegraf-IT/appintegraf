import { prisma } from "@/lib/db";
import { hasExplicitMaketyVyrobaRole } from "@/lib/auth-utils";

export type MaketyVyrobaUser = {
  id: number;
  first_name: string;
  last_name: string;
};

/** Aktivní uživatelé s explicitní úrovní „Výroba maket“ (bez globálního admina). */
export async function getUsersWithMaketyVyrobaAccess(): Promise<MaketyVyrobaUser[]> {
  const users = await prisma.users.findMany({
    where: { is_active: true },
    orderBy: [{ last_name: "asc" }, { first_name: "asc" }],
    select: { id: true, first_name: true, last_name: true },
  });

  const result: MaketyVyrobaUser[] = [];
  for (const u of users) {
    if (await hasExplicitMaketyVyrobaRole(u.id)) {
      result.push(u);
    }
  }
  return result;
}

/** Validace přiřazení zakázky – jen explicitní role výroby. */
export async function userHasMaketyVyrobaRole(userId: number): Promise<boolean> {
  return hasExplicitMaketyVyrobaRole(userId);
}
