import { prisma } from "@/lib/db";
import { hasExplicitMaketyGrafikaRole } from "@/lib/auth-utils";

export type MaketyGrafikaUser = {
  id: number;
  first_name: string;
  last_name: string;
};

/** Aktivní uživatelé s explicitní úrovní „Grafika“ (bez globálního admina). */
export async function getUsersWithMaketyGrafikaAccess(): Promise<MaketyGrafikaUser[]> {
  const users = await prisma.users.findMany({
    where: { is_active: true },
    orderBy: [{ last_name: "asc" }, { first_name: "asc" }],
    select: { id: true, first_name: true, last_name: true },
  });

  const result: MaketyGrafikaUser[] = [];
  for (const u of users) {
    if (await hasExplicitMaketyGrafikaRole(u.id)) {
      result.push(u);
    }
  }
  return result;
}

/** Validace přiřazení zakázky grafiky – jen explicitní role grafika. */
export async function userHasMaketyGrafikaRole(userId: number): Promise<boolean> {
  return hasExplicitMaketyGrafikaRole(userId);
}
