/**
 * Minimální XML export objednávky (Cicero / Pey).
 * TODO: upřesnit elementy a atributy dle finální specifikace rozhraní od dodavatele.
 */

export function escapeXml(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export type ImlOrderXmlProduct = {
  ig_code: string | null;
  ig_short_name: string | null;
  client_name: string | null;
};

export type ImlOrderXmlItem = {
  quantity: number;
  unit_price: unknown;
  subtotal: unknown;
  iml_products: ImlOrderXmlProduct | null;
};

export type ImlOrderXmlPayload = {
  order_number: string;
  order_date: Date;
  status: string | null;
  notes: string | null;
  iml_customers: { name: string; email: string | null; phone: string | null } | null;
  shipping_snapshot_label: string | null;
  shipping_snapshot_recipient: string | null;
  shipping_snapshot_street: string | null;
  shipping_snapshot_city: string | null;
  shipping_snapshot_postal_code: string | null;
  shipping_snapshot_country: string | null;
  iml_order_items: ImlOrderXmlItem[];
};

export function buildImlOrderXml(order: ImlOrderXmlPayload): string {
  const c = order.iml_customers;
  const lines: string[] = [];
  lines.push('<?xml version="1.0" encoding="UTF-8"?>');
  lines.push("<Order>");
  lines.push("  <Header>");
  lines.push(`    <OrderNumber>${escapeXml(order.order_number)}</OrderNumber>`);
  lines.push(
    `    <OrderDate>${escapeXml(order.order_date.toISOString().slice(0, 10))}</OrderDate>`
  );
  lines.push(`    <Status>${escapeXml(order.status ?? "")}</Status>`);
  if (order.notes) {
    lines.push(`    <Notes>${escapeXml(order.notes)}</Notes>`);
  }
  lines.push("    <Customer>");
  if (c) {
    lines.push(`      <Name>${escapeXml(c.name)}</Name>`);
    if (c.email) lines.push(`      <Email>${escapeXml(c.email)}</Email>`);
    if (c.phone) lines.push(`      <Phone>${escapeXml(c.phone)}</Phone>`);
  }
  lines.push("    </Customer>");
  lines.push("    <ShippingAddress>");
  lines.push(
    `      <Label>${escapeXml(order.shipping_snapshot_label ?? "")}</Label>`
  );
  lines.push(
    `      <Recipient>${escapeXml(order.shipping_snapshot_recipient ?? "")}</Recipient>`
  );
  lines.push(
    `      <Street>${escapeXml(order.shipping_snapshot_street ?? "")}</Street>`
  );
  lines.push(`      <City>${escapeXml(order.shipping_snapshot_city ?? "")}</City>`);
  lines.push(
    `      <PostalCode>${escapeXml(order.shipping_snapshot_postal_code ?? "")}</PostalCode>`
  );
  lines.push(
    `      <Country>${escapeXml(order.shipping_snapshot_country ?? "")}</Country>`
  );
  lines.push("    </ShippingAddress>");
  lines.push("  </Header>");
  lines.push("  <Items>");
  for (const it of order.iml_order_items) {
    const p = it.iml_products;
    const code = p?.ig_code ?? "";
    const name = p?.client_name ?? p?.ig_short_name ?? "";
    lines.push("    <Item>");
    lines.push(`      <ProductCode>${escapeXml(code)}</ProductCode>`);
    lines.push(`      <ProductName>${escapeXml(name)}</ProductName>`);
    lines.push(`      <Quantity>${it.quantity}</Quantity>`);
    lines.push(
      `      <UnitPrice>${it.unit_price != null ? escapeXml(String(it.unit_price)) : ""}</UnitPrice>`
    );
    lines.push(
      `      <Subtotal>${it.subtotal != null ? escapeXml(String(it.subtotal)) : ""}</Subtotal>`
    );
    lines.push("    </Item>");
  }
  lines.push("  </Items>");
  lines.push("</Order>");
  return lines.join("\n");
}
