import { auth } from "@/auth";
import { hasModuleAccess } from "@/lib/auth-utils";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Upload, Users, Package, ShoppingCart } from "lucide-react";

export default async function ImlImportsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const userId = parseInt(session.user.id, 10);
  const canWrite = await hasModuleAccess(userId, "iml", "write");

  if (!canWrite) redirect("/iml");

  const imports = [
    {
      href: "/iml/customers/import",
      icon: Users,
      label: "Import zákazníků",
      description: "CSV, Excel – drag & drop mapování",
    },
    {
      href: "/iml/products/import",
      icon: Package,
      label: "Import produktů",
      description: "CSV, Excel – drag & drop mapování",
    },
    {
      href: "/iml/orders/import",
      icon: ShoppingCart,
      label: "Import objednávek",
      description: "CSV, Excel – drag & drop mapování",
    },
  ];

  return (
    <>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900">
            <Upload className="h-7 w-7 text-red-600" />
            Importy IML
          </h1>
          <p className="mt-1 text-gray-600">
            Import zákazníků, produktů a objednávek z CSV nebo Excel
          </p>
        </div>
        <Link
          href="/iml"
          className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50"
        >
          <ArrowLeft className="h-4 w-4" />
          Přehled IML
        </Link>
      </div>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {imports.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex flex-col gap-4 rounded-xl border border-gray-200 bg-white p-6 shadow-sm transition-colors hover:border-red-200 hover:bg-red-50/50"
            >
              <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-red-100 text-red-600">
                <Icon className="h-7 w-7" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">{item.label}</h3>
                <p className="mt-1 text-sm text-gray-500">{item.description}</p>
              </div>
              <span className="text-sm font-medium text-red-600">
                Otevřít import →
              </span>
            </Link>
          );
        })}
      </div>
    </>
  );
}
