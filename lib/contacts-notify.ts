import { prisma } from "@/lib/db";
import { hasModuleAccess } from "@/lib/auth-utils";

/**
 * Oznámí uživatelům s právem zápisu do kontaktů (vč. adminů) nový kontakt.
 * Vytvářejícího uživatele vynechá.
 */
export async function notifyContactsEditorsNewContact(
  creatorUserId: number,
  newContactId: number,
  displayName: string
): Promise<void> {
  const candidates = await prisma.users.findMany({
    where: { OR: [{ is_active: true }, { is_active: null }], id: { not: creatorUserId } },
    select: { id: true },
  });

  const recipientIds: number[] = [];
  for (const u of candidates) {
    if (await hasModuleAccess(u.id, "contacts", "write")) {
      recipientIds.push(u.id);
    }
  }

  if (recipientIds.length === 0) return;

  await prisma.notifications.createMany({
    data: recipientIds.map((user_id) => ({
      user_id,
      title: "Nový kontakt",
      message: `Byl přidán kontakt: ${displayName}.`,
      link: `/contacts/${newContactId}`,
      type: "contacts",
    })),
  });
}
