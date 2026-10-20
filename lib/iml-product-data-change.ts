import { prisma } from "@/lib/db";
import { logImlAudit } from "@/lib/iml-audit";
import { IML_ITEM_STATUS_DATA_CHANGE } from "@/lib/iml-constants";
import { notifyImlProductDataChanged } from "@/lib/iml-notify";

function productLabel(product: {
  ig_code: string | null;
  client_name: string | null;
  id: number;
}): string {
  const code = product.ig_code?.trim();
  const name = product.client_name?.trim();
  if (code && name) return `${code} (${name})`;
  if (code) return code;
  if (name) return name;
  return `#${product.id}`;
}

/**
 * Po změně tiskových PDF nastaví stav „Změna dat“ a odešle in-app notifikace.
 */
export async function markImlProductDataChanged(params: {
  productId: number;
  actorUserId: number;
  reason: "upload" | "delete" | "restore" | "transfer";
}): Promise<void> {
  const product = await prisma.iml_products.findUnique({
    where: { id: params.productId },
    select: {
      id: true,
      ig_code: true,
      client_name: true,
      item_status: true,
    },
  });
  if (!product) return;

  const reasonLabel =
    params.reason === "upload"
      ? "nahrání / nahrazení"
      : params.reason === "delete"
        ? "smazání"
        : params.reason === "restore"
          ? "obnovení verze"
          : "přenos z grafiky";

  await prisma.iml_products.update({
    where: { id: params.productId },
    data: { item_status: IML_ITEM_STATUS_DATA_CHANGE },
  });

  await logImlAudit({
    userId: params.actorUserId,
    action: "update",
    tableName: "iml_products",
    recordId: params.productId,
    oldValues: { item_status: product.item_status },
    newValues: {
      item_status: IML_ITEM_STATUS_DATA_CHANGE,
      reason: params.reason,
    },
  });

  await notifyImlProductDataChanged({
    productId: params.productId,
    actorUserId: params.actorUserId,
    productLabel: productLabel(product),
    reason: reasonLabel,
  });
}
