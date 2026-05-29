/** Souhrn pro přehled objednávek (Pantone, kusy, náhled produktu). */

export type OrderListProductColor = {
  iml_pantone_colors: { code: string; hex: string | null } | null;
};

export type OrderListProduct = {
  id: number;
  ig_code: string | null;
  ig_short_name: string | null;
  client_name: string | null;
  product_format: string | null;
  label_shape_code: string | null;
  iml_product_colors: OrderListProductColor[];
};

export type OrderListItem = {
  quantity: number;
  iml_products: OrderListProduct | null;
};

export type OrderListMetaInput = {
  iml_order_items: OrderListItem[];
};

export type OrderListMeta = {
  total_qty: number;
  pantone_codes: string[];
  pantone_summary: string;
  product_summary: string;
  primary_product_id: number | null;
  has_image: boolean;
};

export function buildOrderListMeta(
  order: OrderListMetaInput,
  flagsById: Map<number, { has_image: boolean }>
): OrderListMeta {
  const items = order.iml_order_items ?? [];
  let totalQty = 0;
  const pantoneSet = new Set<string>();
  const formatParts: string[] = [];
  let primaryProductId: number | null = null;

  for (const it of items) {
    totalQty += it.quantity;
    const p = it.iml_products;
    if (!p) continue;
    if (primaryProductId == null) primaryProductId = p.id;

    const fmt = p.product_format?.trim() || p.label_shape_code?.trim();
    if (fmt && !formatParts.includes(fmt) && formatParts.length < 4) {
      formatParts.push(fmt);
    }

    for (const c of p.iml_product_colors ?? []) {
      const code = c.iml_pantone_colors?.code?.trim();
      if (code) pantoneSet.add(code);
    }
  }

  const pantone_codes = [...pantoneSet].sort((a, b) => a.localeCompare(b, "cs"));
  const maxShow = 8;
  const shown = pantone_codes.slice(0, maxShow);
  const pantone_summary =
    shown.join(", ") + (pantone_codes.length > maxShow ? ` +${pantone_codes.length - maxShow}` : "");

  let product_summary = formatParts.join(" · ");
  if (!product_summary) {
    const labels = items
      .map((it) => it.iml_products?.ig_code || it.iml_products?.ig_short_name || it.iml_products?.client_name)
      .filter((x): x is string => !!x && x.length > 0);
    const uniq: string[] = [];
    for (const l of labels) {
      if (!uniq.includes(l) && uniq.length < 3) uniq.push(l);
    }
    product_summary = uniq.join(", ");
  }

  const has_image =
    primaryProductId != null ? flagsById.get(primaryProductId)?.has_image ?? false : false;

  return {
    total_qty: totalQty,
    pantone_codes,
    pantone_summary: pantone_summary || "—",
    product_summary: product_summary || "—",
    primary_product_id: primaryProductId,
    has_image,
  };
}
