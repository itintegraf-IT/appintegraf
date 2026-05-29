import { auth } from "@/auth";
import { hasModuleAccess } from "@/lib/auth-utils";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, BarChart3 } from "lucide-react";
import { ImlPantoneReportClient } from "./ImlPantoneReportClient";

export default async function ImlPantoneReportPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const userId = parseInt(session.user.id, 10);
  if (!(await hasModuleAccess(userId, "iml", "read"))) {
    redirect("/");
  }

  return (
    <>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900">
            <BarChart3 className="h-7 w-7 text-red-600" />
            Report: Pantone a spotřeba
          </h1>
          <p className="mt-1 text-gray-600">
            Agregace podle objednávek a výpočet kg dle vzorce v dokumentaci (etikety / arch, pokrytí %)
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

      <ImlPantoneReportClient />
    </>
  );
}
