import { auth } from "@/auth";
import { hasModuleAccess } from "@/lib/auth-utils";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Download } from "lucide-react";
import { ImlExportsClient } from "./ImlExportsClient";

export default async function ImlExportsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const userId = parseInt(session.user.id, 10);
  const canRead = await hasModuleAccess(userId, "iml", "read");
  const canWrite = await hasModuleAccess(userId, "iml", "write");
  if (!canRead) redirect("/iml");

  return (
    <>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900">
            <Download className="h-7 w-7 text-red-600" />
            Export produktů
          </h1>
          <p className="mt-1 text-gray-600">
            Šablony sloupců a filtrů pro CSV / XML (napojení na jiné systémy)
          </p>
        </div>
        <Link
          href="/iml/products"
          className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50"
        >
          <ArrowLeft className="h-4 w-4" />
          Produkty
        </Link>
      </div>
      <ImlExportsClient canWrite={canWrite} />
    </>
  );
}
