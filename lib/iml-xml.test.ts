import { describe, expect, it } from "vitest";
import { buildImlOrderXml, type ImlOrderXmlPayload } from "@/lib/iml-xml";

function baseOrder(
  items: ImlOrderXmlPayload["iml_order_items"]
): ImlOrderXmlPayload {
  return {
    order_number: "ODA26258",
    order_date: new Date("2026-11-03T00:00:00Z"),
    status: "exportovaná",
    notes: null,
    iml_customers: { name: "SFA", email: null, phone: null },
    shipping_snapshot_label: null,
    shipping_snapshot_recipient: null,
    shipping_snapshot_street: null,
    shipping_snapshot_city: null,
    shipping_snapshot_postal_code: null,
    shipping_snapshot_country: null,
    iml_order_items: items,
  };
}

describe("buildImlOrderXml", () => {
  it("u aktivního produktu nastaví PrintSafe true bez varování", () => {
    const xml = buildImlOrderXml(
      baseOrder([
        {
          quantity: 100,
          unit_price: "1",
          subtotal: "100",
          iml_products: {
            ig_code: "403434",
            ig_short_name: "Picard",
            client_name: "Picard Amarena",
            item_status: "aktivní",
            approval_status: "máme",
          },
        },
      ])
    );
    expect(xml).toContain("<ItemStatus>aktivní</ItemStatus>");
    expect(xml).toContain("<ApprovalStatus>máme</ApprovalStatus>");
    expect(xml).toContain("<PrintSafe>true</PrintSafe>");
    expect(xml).toContain("<PrintWarning></PrintWarning>");
  });

  it("u Změna dat nastaví PrintSafe false a varování", () => {
    const xml = buildImlOrderXml(
      baseOrder([
        {
          quantity: 50,
          unit_price: null,
          subtotal: null,
          iml_products: {
            ig_code: "403435",
            ig_short_name: null,
            client_name: "X",
            item_status: "Změna dat",
            approval_status: null,
          },
        },
      ])
    );
    expect(xml).toContain("<ItemStatus>Změna dat</ItemStatus>");
    expect(xml).toContain("<PrintSafe>false</PrintSafe>");
    expect(xml).toContain(
      "<PrintWarning>POZOR: produkt není aktivní (stav: Změna dat)</PrintWarning>"
    );
  });

  it("bez produktu varuje o chybějícím produktu", () => {
    const xml = buildImlOrderXml(
      baseOrder([
        {
          quantity: 1,
          unit_price: null,
          subtotal: null,
          iml_products: null,
        },
      ])
    );
    expect(xml).toContain("<PrintSafe>false</PrintSafe>");
    expect(xml).toContain("<PrintWarning>POZOR: chybí produkt</PrintWarning>");
  });
});
