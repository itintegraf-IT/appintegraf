import type { PrismaTransactionClient } from "@/lib/db";

const ACTIVE_STATUS = "aktivní";

export type OrderItemInput = { product_id: number; quantity: number };

/**
 * Ověří stav produktů v řádcích objednávky. Vrací první problém, pokud není povolen override.
 */
export async function validateOrderItemsProductStatus(
  tx: PrismaTransactionClient,
  items: OrderItemInput[],
  allowNonActive: boolean
): Promise<{ ok: true } | { ok: false; product_id: number; item_status: string | null }> {
  const seen = new Set<number>();
  for (const it of items) {
    if (!it.product_id || it.quantity <= 0) continue;
    if (seen.has(it.product_id)) continue;
    seen.add(it.product_id);

    const product = await tx.iml_products.findUnique({
      where: { id: it.product_id },
      select: { id: true, item_status: true },
    });
    if (!product) {
      return { ok: false, product_id: it.product_id, item_status: null };
    }
    const st = product.item_status?.trim() || "";
    if (st !== ACTIVE_STATUS && !allowNonActive) {
      return { ok: false, product_id: product.id, item_status: product.item_status };
    }
  }
  return { ok: true };
}

export function parseOrderCustomData(val: unknown): Record<string, unknown> | null {
  if (val == null) return null;
  if (typeof val === "object" && !Array.isArray(val)) {
    const obj = val as Record<string, unknown>;
    const clean: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) {
      if (typeof k === "string" && /^[a-z0-9_]+$/.test(k)) {
        if (v === null || v === undefined || v === "") continue;
        if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") clean[k] = v;
        else if (v instanceof Date) clean[k] = v.toISOString().slice(0, 10);
      }
    }
    return Object.keys(clean).length > 0 ? clean : null;
  }
  return null;
}

export type ShippingSnapshotFields = {
  shipping_address_id: number | null;
  shipping_snapshot_label: string | null;
  shipping_snapshot_recipient: string | null;
  shipping_snapshot_street: string | null;
  shipping_snapshot_city: string | null;
  shipping_snapshot_postal_code: string | null;
  shipping_snapshot_country: string | null;
};

export async function resolveShippingSnapshot(
  tx: PrismaTransactionClient,
  customerId: number,
  shippingAddressId: number | null | undefined
): Promise<ShippingSnapshotFields> {
  const empty: ShippingSnapshotFields = {
    shipping_address_id: null,
    shipping_snapshot_label: null,
    shipping_snapshot_recipient: null,
    shipping_snapshot_street: null,
    shipping_snapshot_city: null,
    shipping_snapshot_postal_code: null,
    shipping_snapshot_country: null,
  };
  if (!shippingAddressId) return empty;

  const addr = await tx.iml_customer_shipping_addresses.findFirst({
    where: { id: shippingAddressId, customer_id: customerId },
  });
  if (!addr) return empty;

  return {
    shipping_address_id: addr.id,
    shipping_snapshot_label: addr.label,
    shipping_snapshot_recipient: addr.recipient,
    shipping_snapshot_street: addr.street,
    shipping_snapshot_city: addr.city,
    shipping_snapshot_postal_code: addr.postal_code,
    shipping_snapshot_country: addr.country,
  };
}
