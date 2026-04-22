import { notFound } from "next/navigation";
import Link from "next/link";
import { auth } from "@/auth";
import { hasModuleAccess } from "@/lib/auth-utils";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";
import {
  Package,
  ShoppingCart,
  BarChart3,
  Calendar,
  User,
  Building2,
  Wrench,
  MapPin,
  FileText,
} from "lucide-react";
import CustomerShippingAddresses from "../_components/CustomerShippingAddresses";
import CustomerDetailView, {
  type DetailSection,
} from "../_components/CustomerDetailView";

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
        iml_products: {
          select: { id: true, ig_code: true, ig_short_name: true, client_name: true },
        },
        iml_orders: {
          select: {
            id: true,
            order_number: true,
            order_date: true,
            status: true,
            total: true,
          },
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

      type OrderRow = {
        order_date: Date;
        iml_order_items: Array<{ quantity: number }>;
        total?: unknown;
      };
      const ordersTyped = orders as OrderRow[];

      const lastOrder =
        ordersTyped.length > 0
          ? ordersTyped.reduce((a, b) => (a.order_date > b.order_date ? a : b))
          : null;
      const totalQuantity = ordersTyped.reduce(
        (sum, o) => sum + o.iml_order_items.reduce((s, i) => s + i.quantity, 0),
        0
      );
      const ordersLast12Months = ordersTyped.filter(
        (o) => new Date(o.order_date) >= twelveMonthsAgo
      );
      const avgOrderTotal =
        ordersLast12Months.length > 0
          ? ordersLast12Months.reduce(
              (s, o) => s + (o.total ? Number(o.total) : 0),
              0
            ) / ordersLast12Months.length
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

  type ProductRow = {
    id: number;
    ig_code: string | null;
    client_name: string | null;
    ig_short_name: string | null;
  };
  type OrderRow = {
    id: number;
    order_number: string;
    order_date: Date;
    status: string | null;
    total: unknown;
  };
  const products = customer.iml_products as ProductRow[];
  const orders = customer.iml_orders as OrderRow[];

  const hasIndividual =
    Boolean(customer.label_requirements) ||
    Boolean(customer.pallet_packaging) ||
    Boolean(customer.prepress_notes) ||
    Boolean(customer.individual_requirements);

  const statsBlock =
    stats.ordersCount > 0 ? (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
          <p className="mt-1 text-lg font-semibold text-gray-900">
            {stats.ordersCount}
          </p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Package className="h-4 w-4" />
            Celkové množství
          </div>
          <p className="mt-1 text-lg font-semibold text-gray-900">
            {stats.totalQuantity} ks
          </p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <ShoppingCart className="h-4 w-4" />
            Průměrná objednávka (12 m)
          </div>
          <p className="mt-1 text-lg font-semibold text-gray-900">
            {stats.avgOrderTotal != null
              ? `${Math.round(stats.avgOrderTotal)} Kč`
              : "-"}
          </p>
        </div>
      </div>
    ) : null;

  const sections: DetailSection[] = [
    {
      id: "contact",
      label: "Kontakt",
      icon: <User className="h-4 w-4" />,
      content: (
        <div className="grid gap-4 sm:grid-cols-2">
          <InfoField label="E-mail" value={customer.email} />
          <InfoField label="Telefon" value={customer.phone} />
          <InfoField label="Kontaktní osoba" value={customer.contact_person} />
          <InfoField
            label="% tolerance pod-/nadnákladu"
            value={
              customer.allow_under_over_delivery_percent != null
                ? `${customer.allow_under_over_delivery_percent} %`
                : null
            }
          />
        </div>
      ),
    },
    {
      id: "billing",
      label: "Fakturační údaje",
      icon: <Building2 className="h-4 w-4" />,
      content: (
        <div className="grid gap-4 sm:grid-cols-2">
          <InfoField
            label="Fakturační název firmy"
            value={customer.billing_company ?? customer.name}
            span={2}
          />
          <InfoField label="IČO" value={customer.ico} />
          <InfoField label="DIČ" value={customer.dic} />
          {customer.billing_address && (
            <div className="sm:col-span-2">
              <p className="text-sm text-gray-500">Fakturační adresa</p>
              <p className="whitespace-pre-wrap font-medium">
                {customer.billing_address}
              </p>
            </div>
          )}
          {(customer.city || customer.postal_code || customer.country) && (
            <InfoField
              label="Město / PSČ / Země"
              value={
                [
                  [customer.postal_code, customer.city].filter(Boolean).join(" "),
                  customer.country,
                ]
                  .filter(Boolean)
                  .join(", ") || null
              }
              span={2}
            />
          )}
        </div>
      ),
    },
    {
      id: "individual",
      label: "Individuální požadavky",
      icon: <Wrench className="h-4 w-4" />,
      hidden: !hasIndividual,
      content: (
        <div className="space-y-4">
          {customer.label_requirements && (
            <InfoBlock
              label="Požadavky na etikety"
              value={customer.label_requirements}
            />
          )}
          {customer.pallet_packaging && (
            <InfoBlock label="Palety / balení" value={customer.pallet_packaging} />
          )}
          {customer.prepress_notes && (
            <InfoBlock
              label="Poznámky k pre-pressu"
              value={customer.prepress_notes}
            />
          )}
          {customer.individual_requirements && (
            <InfoBlock
              label="Individuální požadavky (legacy)"
              value={customer.individual_requirements}
            />
          )}
        </div>
      ),
    },
    {
      id: "shipping",
      label: "Doručovací adresy",
      icon: <MapPin className="h-4 w-4" />,
      content: (
        <CustomerShippingAddresses
          customerId={customer.id}
          canWrite={canWrite}
          embedded
        />
      ),
    },
    {
      id: "products",
      label: "Produkty",
      icon: <Package className="h-4 w-4" />,
      hidden: products.length === 0,
      badge: products.length || null,
      content: (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-gray-200 bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left text-sm font-semibold text-gray-700">
                  Kód IG
                </th>
                <th className="px-4 py-2 text-left text-sm font-semibold text-gray-700">
                  Název
                </th>
                <th className="px-4 py-2 text-right text-sm font-semibold text-gray-700">
                  Akce
                </th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => (
                <tr
                  key={p.id}
                  className="border-b border-gray-100 hover:bg-gray-50"
                >
                  <td className="px-4 py-3 font-mono text-sm">
                    {p.ig_code ?? "-"}
                  </td>
                  <td className="px-4 py-3">
                    {p.client_name ?? p.ig_short_name ?? "-"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/iml/products/${p.id}`}
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
      ),
    },
    {
      id: "orders",
      label: "Objednávky",
      icon: <ShoppingCart className="h-4 w-4" />,
      hidden: orders.length === 0,
      badge: orders.length || null,
      content: (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-gray-200 bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left text-sm font-semibold text-gray-700">
                  Číslo
                </th>
                <th className="px-4 py-2 text-left text-sm font-semibold text-gray-700">
                  Datum
                </th>
                <th className="px-4 py-2 text-left text-sm font-semibold text-gray-700">
                  Stav
                </th>
                <th className="px-4 py-2 text-right text-sm font-semibold text-gray-700">
                  Celkem
                </th>
                <th className="px-4 py-2 text-right text-sm font-semibold text-gray-700">
                  Akce
                </th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr
                  key={o.id}
                  className="border-b border-gray-100 hover:bg-gray-50"
                >
                  <td className="px-4 py-3 font-mono text-sm">{o.order_number}</td>
                  <td className="px-4 py-3">
                    {new Date(o.order_date).toLocaleDateString("cs-CZ")}
                  </td>
                  <td className="px-4 py-3">
                    <span className="rounded bg-gray-100 px-2 py-0.5 text-sm">
                      {o.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {o.total != null ? `${Number(o.total)} Kč` : "-"}
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
      ),
    },
    {
      id: "notes",
      label: "Poznámka",
      icon: <FileText className="h-4 w-4" />,
      hidden: !customer.customer_note,
      content: (
        <p className="whitespace-pre-wrap text-gray-700">
          {customer.customer_note}
        </p>
      ),
    },
  ];

  return (
    <CustomerDetailView
      title={customer.name}
      customerId={customer.id}
      canWrite={canWrite}
      stats={statsBlock}
      sections={sections}
      legacyShippingAddress={customer.shipping_address}
    />
  );
}

function InfoField({
  label,
  value,
  span = 1,
}: {
  label: string;
  value: string | null | undefined;
  span?: 1 | 2;
}) {
  return (
    <div className={span === 2 ? "sm:col-span-2" : ""}>
      <p className="text-sm text-gray-500">{label}</p>
      <p className="font-medium">{value && value.trim() !== "" ? value : "-"}</p>
    </div>
  );
}

function InfoBlock({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-sm text-gray-500">{label}</p>
      <p className="mt-1 whitespace-pre-wrap text-gray-800">{value}</p>
    </div>
  );
}
