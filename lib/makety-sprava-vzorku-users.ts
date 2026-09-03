import { prisma } from "@/lib/db";
import { hasExplicitMaketySpravaVzorkuRole } from "@/lib/auth-utils";

export type MaketySpravaVzorkuUser = {
  id: number;
  first_name: string;
  last_name: string;
};

export async function getUsersWithMaketySpravaVzorkuAccess(): Promise<MaketySpravaVzorkuUser[]> {
  const users = await prisma.users.findMany({
    where: { is_active: true },
    orderBy: [{ last_name: "asc" }, { first_name: "asc" }],
    select: { id: true, first_name: true, last_name: true },
  });
  const result: MaketySpravaVzorkuUser[] = [];
  for (const u of users) {
    if (await hasExplicitMaketySpravaVzorkuRole(u.id)) result.push(u);
  }
  return result;
}
