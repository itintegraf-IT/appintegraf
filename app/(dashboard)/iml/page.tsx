import { auth } from "@/auth";
import { hasModuleAccess } from "@/lib/auth-utils";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Package, Users, ShoppingCart, FileText, BarChart3, Clock } from "lucide-react";
import { subMonths } from "date-fns";

export default async function ImlPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const userId = parseInt(session.user.id, 10);
  const canRead = await hasModuleAccess(userId, "iml", "read");
  const canWrite = await hasModuleAccess(userId, "iml", "write");

  if (!canRead) {
    redirect("/");
  }

  const twelveMonthsAgo = subMonths(new Date(), 12);

  const [
    customersCount,
    productsCount,
    ordersCount,
    ordersByStatus,
    ordersToProcess,
    recentOrders,
    topCustomersByOrders,
    productsByStatus,
    ordersLast12Months,
  ] = await Promise.all([
    prisma.iml_customers.count(),
    prisma.iml_products.count({ where: { is_active: true } }),
    prisma.iml_orders.count(),
    prisma.iml_orders.groupBy({
      by: ["status"],
      _count: { id: true },
    }),
    prisma.iml_orders.count({
      where: { status: { in: ["nová", "potvrzená"] } },
    }),
    prisma.iml_orders.findMany({
      take: 5,
      orderBy: { order_date: "desc" },
      include: { iml_customers: { select: { name: true } } },
    }),
    prisma.iml_orders.groupBy({
      by: ["customer_id"],
      _count: { id: true },
      orderBy: { _count: { id: "desc" } },
      take: 5,
    }),
    prisma.iml_products.groupBy({
      by: ["item_status"],
      _count: { id: true },
      where: { item_status: { not: null } },
    }),
    prisma.iml_orders.aggregate({
      where: { order_date: { gte: twelveMonthsAgo } },
      _count: { id: true },
      _sum: { total: true },
    }),
  ]);

  const customerIds = topCustomersByOrders.map((o) => o.customer_id);
  const customerNames = customerIds.length
    ? await prisma.iml_customers.findMany({
        where: { id: { in: customerIds } },
        select: { id: true, name: true },
      })
    : [];
  const customerMap = new Map(customerNames.map((c) => [c.id, c.name]));

  const cards = [
    { href: "/iml/customers", icon: Users, value: customersCount, label: "Zákazníci" },
    { href: "/iml/products", icon: Package, value: productsCount, label: "Produkty" },
    { href: "/iml/orders", icon: ShoppingCart, value: ordersCount, label: "Objednávky" },
  ];

  return (
    <>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900">
            <Package className="h-7 w-7 text-red-600" />
            IML
          </h1>
          <p className="mt-1 text-gray-600">Zákazníci, produkty a objednávky</p>
        </div>
        <div className="flex gap-2">
          {canWrite && (
            <>
              <Link
                href="/iml/customers/add"
                className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50"
              >
                <Users className="h-4 w-4" />
                Nový zákazník
              </Link>
              <Link
                href="/iml/products/add"
                className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50"
              >
                <Package className="h-4 w-4" />
                Nový produkt
              </Link>
              <Link
                href="/iml/orders/add"
                className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 font-medium text-white hover:bg-red-700"
              >
                <ShoppingCart className="h-4 w-4" />
                Nová objednávka
              </Link>
            </>
          )}
        </div>
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <Link
              key={card.href}
              href={card.href}
              className="flex items-center gap-4 rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition-colors hover:border-red-200 hover:bg-red-50/50"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-red-100 text-red-600">
                <Icon className="h-6 w-6" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{card.value}</p>
                <p className="text-sm text-gray-500">{card.label}</p>
              </div>
            </Link>
          );
        })}
      </div>

      <div className="mb-8 grid gap-4 lg:grid-cols-2">
        {ordersToProcess > 0 && (
          <Link
            href="/iml/orders"
            className="flex items-center gap-4 rounded-xl border border-amber-200 bg-amber-50/50 p-5 shadow-sm transition-colors hover:border-amber-300 hover:bg-amber-50"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-amber-100 text-amber-600">
              <Clock className="h-6 w-6" />
            </div>
            <div>
              <p className="text-2xl font-bold text-amber-800">{ordersToProcess}</p>
              <p className="text-sm text-amber-700">Objednávky ke zpracování (nové + potvrzené)</p>
            </div>
          </Link>
        )}

        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-700">
            <BarChart3 className="h-4 w-4" />
            Report – objednávky za 12 měsíců
          </h3>
          <div className="flex flex-wrap gap-4 text-sm">
            <div>
              <span className="text-gray-500">Počet objednávek:</span>{" "}
              <span className="font-semibold">{ordersLast12Months._count.id}</span>
            </div>
            <div>
              <span className="text-gray-500">Celková hodnota:</span>{" "}
              <span className="font-semibold">
                {ordersLast12Months._sum.total != null
                  ? `${Number(ordersLast12Months._sum.total).toLocaleString("cs-CZ")} Kč`
                  : "—"}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="mb-8 grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-700">
            <BarChart3 className="h-4 w-4" />
            Objednávky podle stavu
          </h3>
          <div className="space-y-2">
            {ordersByStatus.map((s) => (
              <div key={s.status} className="flex justify-between text-sm">
                <span className="text-gray-600">{s.status || "(prázdné)"}</span>
                <span className="font-medium">{s._count.id}</span>
              </div>
            ))}
            {ordersByStatus.length === 0 && (
              <p className="text-sm text-gray-500">Žádné objednávky</p>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-700">
            <Users className="h-4 w-4" />
            Top zákazníci (počet objednávek)
          </h3>
          <div className="space-y-2">
            {topCustomersByOrders.map((o) => (
              <div key={o.customer_id} className="flex justify-between text-sm">
                <span className="text-gray-600 truncate max-w-[180px]">
                  {customerMap.get(o.customer_id) ?? `#${o.customer_id}`}
                </span>
                <span className="font-medium">{o._count.id}</span>
              </div>
            ))}
            {topCustomersByOrders.length === 0 && (
              <p className="text-sm text-gray-500">Žádná data</p>
            )}
          </div>
          <Link
            href="/iml/customers"
            className="mt-2 inline-block text-xs font-medium text-red-600 hover:text-red-700"
          >
            Všichni zákazníci →
          </Link>
        </div>
      </div>

      {productsByStatus.length > 0 && (
        <div className="mb-8 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-700">
            <Package className="h-4 w-4" />
            Produkty podle stavu
          </h3>
          <div className="flex flex-wrap gap-4">
            {productsByStatus.map((s) => (
              <div key={s.item_status ?? "null"} className="flex items-center gap-2">
                <span className="rounded bg-gray-100 px-2 py-0.5 text-sm text-gray-700">
                  {s.item_status || "(neuvedeno)"}
                </span>
                <span className="font-medium">{s._count.id}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {recentOrders.length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-gray-900">
            <FileText className="h-5 w-5 text-gray-600" />
            Poslední objednávky
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b border-gray-200 bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-sm font-semibold text-gray-700">Číslo</th>
                  <th className="px-4 py-2 text-left text-sm font-semibold text-gray-700">Zákazník</th>
                  <th className="px-4 py-2 text-left text-sm font-semibold text-gray-700">Datum</th>
                  <th className="px-4 py-2 text-left text-sm font-semibold text-gray-700">Stav</th>
                  <th className="px-4 py-2 text-right text-sm font-semibold text-gray-700">Akce</th>
                </tr>
              </thead>
              <tbody>
                {recentOrders.map((o) => (
                  <tr key={o.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono text-sm">{o.order_number}</td>
                    <td className="px-4 py-3">{o.iml_customers?.name ?? "-"}</td>
                    <td className="px-4 py-3">
                      {new Date(o.order_date).toLocaleDateString("cs-CZ")}
                    </td>
                    <td className="px-4 py-3">
                      <span className="rounded bg-gray-100 px-2 py-0.5 text-sm">{o.status}</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/iml/orders/${o.id}`}
                        className="text-sm font-medium text-red-600 hover:text-red-700"
                      >
                        Detail →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Link
            href="/iml/orders"
            className="mt-4 inline-block text-sm font-medium text-gray-600 hover:text-gray-900"
          >
            Zobrazit všechny objednávky →
          </Link>
        </div>
      )}
    </>
  );
}
