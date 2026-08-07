import { prisma } from "@/lib/db";
import {
  hasExplicitMaketySchvalovatelFinalRole,
  hasExplicitMaketySchvalovatelPrepressRole,
} from "@/lib/auth-utils";

export type MaketySchvalovatelUser = {
  id: number;
  first_name: string;
  last_name: string;
};

async function listActiveUsersMatching(
  predicate: (userId: number) => Promise<boolean>
): Promise<MaketySchvalovatelUser[]> {
  const users = await prisma.users.findMany({
    where: { is_active: true },
    orderBy: [{ last_name: "asc" }, { first_name: "asc" }],
    select: { id: true, first_name: true, last_name: true },
  });
  const result: MaketySchvalovatelUser[] = [];
  for (const u of users) {
    if (await predicate(u.id)) result.push(u);
  }
  return result;
}

export async function getUsersWithMaketySchvalovatelPrepressAccess(): Promise<
  MaketySchvalovatelUser[]
> {
  return listActiveUsersMatching(hasExplicitMaketySchvalovatelPrepressRole);
}

export async function getUsersWithMaketySchvalovatelFinalAccess(): Promise<
  MaketySchvalovatelUser[]
> {
  return listActiveUsersMatching(hasExplicitMaketySchvalovatelFinalRole);
}

export async function userHasMaketySchvalovatelPrepressRole(userId: number): Promise<boolean> {
  return hasExplicitMaketySchvalovatelPrepressRole(userId);
}

export async function userHasMaketySchvalovatelFinalRole(userId: number): Promise<boolean> {
  return hasExplicitMaketySchvalovatelFinalRole(userId);
}
