import { prisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";

export const IML_ITEM_STATUS_GRAPHIC_REVISION = "rozpracováno grafikem";
export const IML_ITEM_STATUS_ACTIVE = "aktivní";

/** Zamkne IML produkt kvůli úpravě grafiky (maketa). */
export async function lockImlProductForMaketa(
  productId: number,
  maketaId: number,
  tx?: Prisma.TransactionClient
): Promise<void> {
  const db = tx ?? prisma;
  await db.iml_products.update({
    where: { id: productId },
    data: {
      is_locked: true,
      locked_maketa_id: maketaId,
      item_status: IML_ITEM_STATUS_GRAPHIC_REVISION,
    },
  });
}

/**
 * Odemkne produkt, pokud zámek patří dané maketě (nebo locked_maketa_id je null).
 * Nastaví item_status na aktivní, pokud byl „rozpracováno grafikem“.
 */
export async function unlockImlProductForMaketa(
  productId: number,
  maketaId: number,
  tx?: Prisma.TransactionClient
): Promise<void> {
  const db = tx ?? prisma;
  const product = await db.iml_products.findUnique({
    where: { id: productId },
    select: { is_locked: true, locked_maketa_id: true, item_status: true },
  });
  if (!product?.is_locked) return;
  if (product.locked_maketa_id != null && product.locked_maketa_id !== maketaId) {
    return;
  }
  await db.iml_products.update({
    where: { id: productId },
    data: {
      is_locked: false,
      locked_maketa_id: null,
      ...(product.item_status === IML_ITEM_STATUS_GRAPHIC_REVISION
        ? { item_status: IML_ITEM_STATUS_ACTIVE }
        : {}),
    },
  });
}

/**
 * Po úspěšném překlopení do IML — odemknout cílový produkt.
 * Stav „aktivní“ nastaví jen pokud byl „rozpracováno grafikem“;
 * „Změna dat“ (po přenosu PDF) se nepřepisuje.
 */
export async function unlockImlProductAfterApply(
  productId: number,
  tx?: Prisma.TransactionClient
): Promise<void> {
  const db = tx ?? prisma;
  const product = await db.iml_products.findUnique({
    where: { id: productId },
    select: { item_status: true },
  });
  await db.iml_products.update({
    where: { id: productId },
    data: {
      is_locked: false,
      locked_maketa_id: null,
      ...(product?.item_status === IML_ITEM_STATUS_GRAPHIC_REVISION
        ? { item_status: IML_ITEM_STATUS_ACTIVE }
        : {}),
    },
  });
}
