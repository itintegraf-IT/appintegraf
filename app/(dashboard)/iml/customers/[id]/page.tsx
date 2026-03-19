import { notFound } from "next/navigation";
import Link from "next/link";
import { auth } from "@/auth";
import { hasModuleAccess } from "@/lib/auth-utils";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";
import { ArrowLeft, Package, ShoppingCart, BarChart3, Calendar } from "lucide-react";

export default async function ImlCustomerDetailPage({
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

  const [customer, stats] = await Promise.all([
    prisma.iml_customers.findUnique({
      where: { id },
      include: {
        iml_products: { select: { id: true, ig_code: true, ig_short_name: true, client_name: true } },
        iml_orders: {
          select: { id: true, order_number: true, order_date: true, status: true, total: true },
          orderBy: { order_date: "desc" },
        },
      },
    }),
    (async () => {
      const twelveMonthsAgo = new Date();
      twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

      const orders = await prisma.iml_orders.findMany({
        where: { customer_id: id },
        include: { iml_order_items: { select: { quantity: true } } },
      });

      type OrderRow = { order_date: Date; iml_order_items: Array<{ quantity: number }>; total?: unknown };
      const ordersTyped = orders as OrderRow[];

      const lastOrder = ordersTyped.length > 0
        ? ordersTyped.reduce((a, b) => (a.order_date > b.order_date ? a : b))
        : null;
      const totalQuantity = ordersTyped.reduce(
        (sum, o) => sum + o.iml_order_items.reduce((s, i) => s + i.quantity, 0),
        0
      );
      const ordersLast12Months = ordersTyped.filter((o) => new Date(o.order_date) >= twelveMonthsAgo);
      const avgOrderTotal =
        ordersLast12Months.length > 0
          ? ordersLast12Months.reduce((s, o) => s + (o.total ? Number(o.total) : 0), 0) /
            ordersLast12Months.length
          : null;

      return {
        lastOrderDate: lastOrder?.order_date ?? null,
        totalQuantity,
        avgOrderTotal,
        ordersCount: orders.length,
      };
    })(),
  ]);

  if (!customer) notFound();

  return (
    <>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{customer.name}</h1>
          <p className="mt-1 text-gray-600">Detail zákazníka</p>
        </div>
        <div className="flex gap-2">
          {canWrite && (
            <Link
              href={`/iml/customers/${customer.id}/edit`}
              className="rounded-lg border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50"
            >
              Upravit
            </Link>
          )}
          <Link
            href="/iml/customers"
            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50"
          >
            <ArrowLeft className="h-4 w-4" />
            Zpět
          </Link>
        </div>
      </div>

      {stats.ordersCount > 0 && (
        <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Calendar className="h-4 w-4" />
              Poslední objednávka
            </div>
            <p className="mt-1 text-lg font-semibold text-gray-900">
              {stats.lastOrderDate
                ? new Date(stats.lastOrderDate).toLocaleDateString("cs-CZ")
                : "-"}
            </p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <BarChart3 className="h-4 w-4" />
              Celkem objednávek
            </div>
            <p className="mt-1 text-lg font-semibold text-gray-900">{stats.ordersCount}</p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Package className="h-4 w-4" />
              Celkové množství
            </div>
            <p className="mt-1 text-lg font-semibold text-gray-900">{stats.totalQuantity} ks</p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <ShoppingCart className="h-4 w-4" />
              Průměrná objednávka (12 m)
            </div>
            <p className="mt-1 text-lg font-semibold text-gray-900">
              {stats.avgOrderTotal != null ? `${Math.round(stats.avgOrderTotal)} Kč` : "-"}
            </p>
          </div>
        </div>
      )}

      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="text-sm text-gray-500">E-mail</p>
            <p className="font-medium">{customer.email ?? "-"}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Telefon</p>
            <p className="font-medium">{customer.phone ?? "-"}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Kontaktní osoba</p>
            <p className="font-medium">{customer.contact_person ?? "-"}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">% odchylka pod-/nadnákladu</p>
            <p className="font-medium">{customer.allow_under_over_delivery_percent != null ? `${customer.allow_under_over_delivery_percent} %` : "-"}</p>
          </div>
          {customer.billing_address && (
            <div className="sm:col-span-2">
              <p className="text-sm text-gray-500">Fakturační adresa</p>
              <p className="whitespace-pre-wrap">{customer.billing_address}</p>
            </div>
          )}
          {customer.shipping_address && (
            <div className="sm:col-span-2">
              <p className="text-sm text-gray-500">Doručovací adresa</p>
              <p className="whitespace-pre-wrap">{customer.shipping_address}</p>
            </div>
          )}
          {customer.individual_requirements && (
            <div className="sm:col-span-2">
              <p className="text-sm text-gray-500">Individuální požadavky</p>
              <p className="whitespace-pre-wrap">{customer.individual_requirements}</p>
            </div>
          )}
          {customer.customer_note && (
            <div className="sm:col-span-2">
              <p className="text-sm text-gray-500">Poznámka</p>
              <p className="whitespace-pre-wrap">{customer.customer_note}</p>
            </div>
          )}
        </div>
      </div>

      {customer.iml_products.length > 0 && (
        <div className="mt-6 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-gray-900">
            <Package className="h-5 w-5 text-gray-600" />
            Produkty ({customer.iml_products.length})
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b border-gray-200 bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-sm font-semibold text-gray-700">Kód IG</th>
                  <th className="px-4 py-2 text-left text-sm font-semibold text-gray-700">Název</th>
                  <th className="px-4 py-2 text-right text-sm font-semibold text-gray-700">Akce</th>
                </tr>
              </thead>
              <tbody>
                {customer.iml_products.map((p) => (
                  <tr key={p.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono text-sm">{p.ig_code ?? "-"}</td>
                    <td className="px-4 py-3">{p.client_name ?? p.ig_short_name ?? "-"}</td>
                    <td className="px-4 py-3 text-right">
                      <Link href={`/iml/products/${p.id}`} className="text-sm font-medium text-red-600 hover:text-red-700">
                        Detail →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {customer.iml_orders.length > 0 && (
        <div className="mt-6 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-gray-900">
            <ShoppingCart className="h-5 w-5 text-gray-600" />
            Objednávky ({customer.iml_orders.length})
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b border-gray-200 bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-sm font-semibold text-gray-700">Číslo</th>
                  <th className="px-4 py-2 text-left text-sm font-semibold text-gray-700">Datum</th>
                  <th className="px-4 py-2 text-left text-sm font-semibold text-gray-700">Stav</th>
                  <th className="px-4 py-2 text-right text-sm font-semibold text-gray-700">Celkem</th>
                  <th className="px-4 py-2 text-right text-sm font-semibold text-gray-700">Akce</th>
                </tr>
              </thead>
              <tbody>
                {customer.iml_orders.map((o) => (
                  <tr key={o.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono text-sm">{o.order_number}</td>
                    <td className="px-4 py-3">{new Date(o.order_date).toLocaleDateString("cs-CZ")}</td>
                    <td className="px-4 py-3">
                      <span className="rounded bg-gray-100 px-2 py-0.5 text-sm">{o.status}</span>
                    </td>
                    <td className="px-4 py-3 text-right">{o.total != null ? `${Number(o.total)} Kč` : "-"}</td>
                    <td className="px-4 py-3 text-right">
                      <Link href={`/iml/orders/${o.id}`} className="text-sm font-medium text-red-600 hover:text-red-700">
                        Detail →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}
