import { prisma } from "@/lib/db";

export async function collectMaketaNotifyUserIds(
  assigneeUserId: number | null,
  excludeUserId?: number
): Promise<number[]> {
  const set = new Set<number>();
  if (assigneeUserId != null) {
    const u = await prisma.users.findFirst({
      where: { id: assigneeUserId, is_active: true },
      select: { id: true },
    });
    if (u) set.add(u.id);
  }
  if (excludeUserId != null) set.delete(excludeUserId);
  return [...set];
}
