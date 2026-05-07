import { notFound } from "next/navigation";
import Link from "next/link";
import { auth } from "@/auth";
import { hasModuleAccess } from "@/lib/auth-utils";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";

export default async function ImlOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const userId = parseInt(session.user.id, 10);
  const canRead = await hasModuleAccess(userId, "iml", "read");
  const canWrite = await hasModuleAccess(userId, "iml", "write");

  if (!canRead) redirect("/iml");

  const id = parseInt((await params).id, 10);
  if (isNaN(id)) notFound();

  const [order, customFields] = await Promise.all([
    prisma.iml_orders.findUnique({
      where: { id },
      include: {
        iml_customers: true,
        iml_order_items: {
          include: { iml_products: { select: { id: true, ig_code: true, ig_short_name: true, client_name: true } } },
        },
      },
    }),
    prisma.iml_custom_fields.findMany({
      where: { entity: "orders", is_active: true },
      orderBy: { sort_order: "asc" },
    }),
  ]);

  if (!order) notFound();

  const customData = (order.custom_data as Record<string, unknown> | null) ?? {};
  const hasCustomData = Object.keys(customData).length > 0;

  type CustomFieldRow = { id: number; field_key: string; label: string };
  type OrderItemRow = {
    id: number;
    quantity: number;
    unit_price: number | null;
    subtotal: number | null;
    iml_products: { id: number; ig_code: string | null; ig_short_name: string | null; client_name: string | null };
  };
  const fieldsTyped = customFields as CustomFieldRow[];
  const itemsTyped = order.iml_order_items as OrderItemRow[];

  return (
    <>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Objednávka {order.order_number}</h1>
          <p className="mt-1 text-gray-600">
            {order.iml_customers?.name} • {new Date(order.order_date).toLocaleDateString("cs-CZ")}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a
            href={`/api/iml/orders/${order.id}/export-xml`}
            className="rounded-lg border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50"
          >
            Export XML
          </a>
          {canWrite && (
            <Link
              href={`/iml/orders/${order.id}/edit`}
              className="rounded-lg border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50"
            >
              Upravit
            </Link>
          )}
          <Link
            href="/iml/orders"
            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50"
          >
            <ArrowLeft className="h-4 w-4" />
            Zpět
          </Link>
        </div>
      </div>

      <div className="mb-6 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="text-sm text-gray-500">Zákazník</p>
            <Link href={`/iml/customers/${order.iml_customers?.id}`} className="font-medium text-red-600 hover:text-red-700">
              {order.iml_customers?.name ?? "-"}
            </Link>
          </div>
          <div>
            <p className="text-sm text-gray-500">Datum</p>
            <p className="font-medium">{new Date(order.order_date).toLocaleDateString("cs-CZ")}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Stav</p>
            <p><span className="rounded bg-gray-100 px-2 py-0.5 text-sm">{order.status}</span></p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Celkem</p>
            <p className="font-medium">{order.total != null ? `${Number(order.total)} Kč` : "-"}</p>
          </div>
          {order.notes && (
            <div className="sm:col-span-2">
              <p className="text-sm text-gray-500">Poznámky</p>
              <p className="whitespace-pre-wrap">{order.notes}</p>
            </div>
          )}
        </div>
      </div>

      {(order.shipping_snapshot_recipient ||
        order.shipping_snapshot_street ||
        order.shipping_snapshot_city ||
        order.shipping_snapshot_postal_code ||
        order.shipping_snapshot_country ||
        order.shipping_snapshot_label) && (
        <div className="mb-6 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h3 className="mb-3 text-sm font-semibold text-gray-700">
            Doručovací adresa (snapshot v době vytvoření)
          </h3>
          <div className="grid gap-2 text-sm sm:grid-cols-2">
            {order.shipping_snapshot_label && (
              <div>
                <span className="text-gray-500">Označení: </span>
                {order.shipping_snapshot_label}
              </div>
            )}
            {order.shipping_snapshot_recipient && (
              <div>
                <span className="text-gray-500">Příjemce: </span>
                {order.shipping_snapshot_recipient}
              </div>
            )}
            {order.shipping_snapshot_street && (
              <div className="sm:col-span-2">
                <span className="text-gray-500">Ulice: </span>
                {order.shipping_snapshot_street}
              </div>
            )}
            {(order.shipping_snapshot_postal_code || order.shipping_snapshot_city) && (
              <div className="sm:col-span-2">
                <span className="text-gray-500">PSČ / město: </span>
                {[order.shipping_snapshot_postal_code, order.shipping_snapshot_city]
                  .filter(Boolean)
                  .join(" ")}
              </div>
            )}
            {order.shipping_snapshot_country && (
              <div>
                <span className="text-gray-500">Země: </span>
                {order.shipping_snapshot_country}
              </div>
            )}
          </div>
        </div>
      )}

      {hasCustomData && (
        <div className="mb-6 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h3 className="mb-4 text-sm font-semibold text-gray-700">Vlastní pole</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            {fieldsTyped.map((f) => {
              const val = customData[f.field_key];
              if (val === undefined || val === null || val === "") return null;
              return (
                <div key={f.id}>
                  <p className="text-sm text-gray-500">{f.label}</p>
                  <p className="font-medium">
                    {typeof val === "boolean" ? (val ? "Ano" : "Ne") : String(val)}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
        <h3 className="border-b border-gray-200 px-6 py-4 text-sm font-semibold text-gray-700">Položky</h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-gray-200 bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Produkt</th>
                <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">Množství</th>
                <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">Cena/ks</th>
                <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">Mezisoučet</th>
              </tr>
            </thead>
            <tbody>
              {order.iml_order_items.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-gray-500">
                    Žádné položky
                  </td>
                </tr>
              ) : (
                itemsTyped.map((it) => (
                  <tr key={it.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <Link href={`/iml/products/${it.iml_products.id}`} className="font-medium text-red-600 hover:text-red-700">
                        {it.iml_products.client_name ?? it.iml_products.ig_short_name ?? it.iml_products.ig_code ?? `#${it.iml_products.id}`}
                      </Link>
                      {it.iml_products.ig_code && (
                        <span className="ml-2 font-mono text-sm text-gray-500">{it.iml_products.ig_code}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">{it.quantity}</td>
                    <td className="px-4 py-3 text-right">{it.unit_price != null ? `${Number(it.unit_price)} Kč` : "-"}</td>
                    <td className="px-4 py-3 text-right">{it.subtotal != null ? `${Number(it.subtotal)} Kč` : "-"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
