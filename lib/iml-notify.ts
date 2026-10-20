import { prisma } from "@/lib/db";
import { hasModuleAccess } from "@/lib/auth-utils";

/**
 * In-app notifikace uživatelům s právem zápisu do IML (bez aktéra).
 * Best-effort — selhání nesmí shodit hlavní akci.
 */
export async function notifyImlProductDataChanged(params: {
  productId: number;
  actorUserId: number;
  productLabel: string;
  reason: string;
}): Promise<void> {
  try {
    const candidates = await prisma.users.findMany({
      where: {
        OR: [{ is_active: true }, { is_active: null }],
        id: { not: params.actorUserId },
      },
      select: { id: true },
    });

    const recipientIds: number[] = [];
    for (const u of candidates) {
      if (await hasModuleAccess(u.id, "iml", "write")) {
        recipientIds.push(u.id);
      }
    }
    if (recipientIds.length === 0) return;

    await prisma.notifications.createMany({
      data: recipientIds.map((user_id) => ({
        user_id,
        title: "Změna tiskových dat IML",
        message: `U produktu ${params.productLabel} se změnila tisková data (PDF: ${params.reason}). Stav: Změna dat.`,
        link: `/iml/products/${params.productId}`,
        type: "iml_product_data_change",
      })),
    });
  } catch (e) {
    console.error("notifyImlProductDataChanged", e);
  }
}
