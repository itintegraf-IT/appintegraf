import { prisma } from "@/lib/db";
import {
  isEmailNotificationEnabled,
  parseEmailNotifications,
  type EmailNotificationModule,
} from "@/lib/user-email-notifications";

export async function userAllowsEmailNotification(
  userId: number,
  module: EmailNotificationModule
): Promise<boolean> {
  const user = await prisma.users.findUnique({
    where: { id: userId },
    select: { email_notifications: true },
  });
  if (!user) return true;
  return isEmailNotificationEnabled(parseEmailNotifications(user.email_notifications), module);
}

/** Vrátí podmnožinu userIds, kterým smí jít e-mail pro daný modul. */
export async function filterUserIdsAllowingEmail(
  userIds: number[],
  module: EmailNotificationModule
): Promise<number[]> {
  if (userIds.length === 0) return [];

  const users = await prisma.users.findMany({
    where: { id: { in: userIds } },
    select: { id: true, email_notifications: true },
  });

  const byId = new Map(users.map((u) => [u.id, u]));
  return userIds.filter((id) => {
    const row = byId.get(id);
    if (!row) return true;
    return isEmailNotificationEnabled(parseEmailNotifications(row.email_notifications), module);
  });
}
