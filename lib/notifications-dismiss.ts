import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

export type DismissNotificationsOptions = {
  userId?: number;
  types?: string[];
};

function buildWhere(
  link: string,
  options?: DismissNotificationsOptions
): Prisma.notificationsWhereInput {
  const where: Prisma.notificationsWhereInput = {
    link,
    read_at: null,
  };
  if (options?.userId !== undefined) {
    where.user_id = options.userId;
  }
  if (options?.types?.length) {
    where.type = { in: options.types };
  }
  return where;
}

/** Pro použití uvnitř prisma.$transaction([...]) */
export function dismissNotificationsUpdate(
  link: string,
  options?: DismissNotificationsOptions
) {
  return prisma.notifications.updateMany({
    where: buildWhere(link, options),
    data: { read_at: new Date() },
  });
}

/** Označí nepřečtené notifikace jako přečtené podle linku entity */
export async function dismissNotificationsForLink(
  link: string,
  options?: DismissNotificationsOptions
): Promise<void> {
  await dismissNotificationsUpdate(link, options);
}
