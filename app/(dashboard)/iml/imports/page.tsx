import { auth } from "@/auth";
import { hasModuleAccess } from "@/lib/auth-utils";
import { redirect } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Upload,
  Download,
  Users,
  Package,
  ShoppingCart,
  Scissors,
} from "lucide-react";
import { ImlExportsClient } from "../exports/ImlExportsClient";

export default async function ImlImportsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const userId = parseInt(session.user.id, 10);
  const canRead = await hasModuleAccess(userId, "iml", "read");
  const canWrite = await hasModuleAccess(userId, "iml", "write");

  if (!canRead) redirect("/iml");

  const imports = [
    {
      href: "/iml/customers/import",
      icon: Users,
      label: "Import zákazníků",
      description: "CSV, Excel – drag & drop mapování",
      needsWrite: true,
    },
    {
      href: "/iml/products/import",
      icon: Package,
      label: "Import produktů",
      description: "Složka/ZIP z IMLEXportu nebo doplnění polí z CSV/Excel",
      needsWrite: true,
    },
    {
      href: "/iml/orders/import",
      icon: ShoppingCart,
      label: "Import objednávek",
      description: "CSV, Excel – drag & drop mapování",
      needsWrite: true,
    },
    {
      href: "/iml/die-cuts/import",
      icon: Scissors,
      label: "Import výseků",
      description: "CSV, Excel – mapování polí katalogu výseků",
      needsWrite: true,
    },
  ];

  const visibleImports = imports.filter((i) => !i.needsWrite || canWrite);

  return (
    <>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900">
            <Upload className="h-7 w-7 text-red-600" />
            Import / Export IML
          </h1>
          <p className="mt-1 text-gray-600">
            Import dat do katalogu a export produktů (CSV / XML šablony)
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

      {visibleImports.length > 0 && (
        <section className="mb-10">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">Import</h2>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {visibleImports.map((item) => {
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
                  <span className="text-sm font-medium text-red-600">Otevřít import →</span>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      <section id="export" className="scroll-mt-6">
        <div className="mb-4 flex items-center gap-2">
          <Download className="h-5 w-5 text-red-600" />
          <h2 className="text-lg font-semibold text-gray-900">Export produktů</h2>
        </div>
        <p className="mb-4 text-sm text-gray-600">
          Šablony sloupců a filtrů pro CSV / XML (napojení na jiné systémy). Rychlý export všech
          sloupců zůstává i na seznamu produktů.
        </p>
        <ImlExportsClient canWrite={canWrite} />
      </section>
    </>
  );
}
