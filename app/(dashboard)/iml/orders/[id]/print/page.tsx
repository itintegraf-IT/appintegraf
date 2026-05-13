import { auth } from "@/auth";
import { hasModuleAccess } from "@/lib/auth-utils";
import { prisma } from "@/lib/db";
import { redirect, notFound } from "next/navigation";
import { ImlOrderPrintClient, type PrintOrderPayload } from "./ImlOrderPrintClient";

export default async function ImlOrderPrintPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const userId = parseInt(session.user.id, 10);
  if (!(await hasModuleAccess(userId, "iml", "read"))) {
    redirect("/iml");
  }

  const id = parseInt((await params).id, 10);
  if (Number.isNaN(id)) notFound();

  const order = await prisma.iml_orders.findUnique({
    where: { id },
    include: {
      iml_customers: { select: { name: true } },
      iml_order_items: {
        orderBy: { id: "asc" },
        include: {
          iml_products: {
            select: {
              ig_code: true,
              ig_short_name: true,
              client_name: true,
              product_format: true,
              iml_product_colors: {
                orderBy: { sort_order: "asc" },
                select: { iml_pantone_colors: { select: { code: true } } },
              },
            },
          },
        },
      },
    },
  });

  if (!order) notFound();

  const payload: PrintOrderPayload = {
    id: order.id,
    order_number: order.order_number,
    order_date: order.order_date.toISOString(),
    expected_ship_date: order.expected_ship_date ? order.expected_ship_date.toISOString() : null,
    status: order.status,
    customer_name: order.iml_customers?.name ?? "",
    notes: order.notes,
    shipping: {
      label: order.shipping_snapshot_label,
      recipient: order.shipping_snapshot_recipient,
      street: order.shipping_snapshot_street,
      city: order.shipping_snapshot_city,
      postal_code: order.shipping_snapshot_postal_code,
      country: order.shipping_snapshot_country,
    },
    items: order.iml_order_items.map((it) => {
      const p = it.iml_products;
      const pantone_codes: string[] = [];
      const seen = new Set<string>();
      for (const c of p?.iml_product_colors ?? []) {
        const code = c.iml_pantone_colors?.code?.trim();
        if (code && !seen.has(code)) {
          seen.add(code);
          pantone_codes.push(code);
        }
      }
      return {
        quantity: it.quantity,
        ig_code: p?.ig_code ?? null,
        ig_short_name: p?.ig_short_name ?? null,
        client_name: p?.client_name ?? null,
        product_format: p?.product_format ?? null,
        pantone_codes,
      };
    }),
  };

  return <ImlOrderPrintClient order={payload} />;
}
