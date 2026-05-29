import { auth } from "@/auth";
import { hasModuleAccess } from "@/lib/auth-utils";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ShoppingCart, Plus, ArrowLeft, Upload } from "lucide-react";
import { ImlOrdersClient } from "./ImlOrdersClient";

export default async function ImlOrdersPage() {
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
            <ShoppingCart className="h-7 w-7 text-red-600" />
            Objednávky IML
          </h1>
          <p className="mt-1 text-gray-600">Evidence objednávek</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/iml"
            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50"
          >
            <ArrowLeft className="h-4 w-4" />
            Přehled IML
          </Link>
          {canWrite && (
            <>
              <Link
                href="/iml/orders/import"
                className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50"
              >
                <Upload className="h-4 w-4" />
                Import CSV/Excel
              </Link>
              <Link
                href="/iml/orders/add"
                className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 font-medium text-white hover:bg-red-700"
              >
                <Plus className="h-4 w-4" />
                Nová objednávka
              </Link>
            </>
          )}
        </div>
      </div>

      <ImlOrdersClient canRead={canRead} canWrite={canWrite} />
    </>
  );
}
