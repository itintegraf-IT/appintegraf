import Link from "next/link";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { hasModuleAccess } from "@/lib/auth-utils";
import { canReadMaterialCatalog } from "@/lib/materialy/access";
import { MATERIAL_CATEGORIES } from "@/lib/materialy/categories";
import { Layers, FileWarning } from "lucide-react";
import { MaterialyHubSearch } from "./_components/MaterialyHubSearch";

export default async function MaterialyHubPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const userId = parseInt(session.user.id, 10);
  if (!(await canReadMaterialCatalog(userId))) redirect("/");

  const canWrite = await hasModuleAccess(userId, "materialy", "write");

  return (
    <>
      <div className="mb-8">
        <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900">
          <Layers className="h-7 w-7 text-red-600" />
          Katalog materiálů
        </h1>
        <p className="mt-1 text-gray-600">Bezpečnostní listy a číselníky papírů, fólií, barev a laků</p>
      </div>

      <MaterialyHubSearch />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {MATERIAL_CATEGORIES.map((cat: (typeof MATERIAL_CATEGORIES)[number]) => (
          <Link
            key={cat.code}
            href={`/materialy/${cat.slug}`}
            className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition hover:border-red-200 hover:shadow-md"
          >
            <h2 className="font-semibold text-gray-900">{cat.label}</h2>
            <p className="mt-1 text-sm text-gray-500">Seznam a dokumenty</p>
          </Link>
        ))}
      </div>

      <div className="mt-8 flex flex-wrap gap-3">
        {canWrite && (
          <Link
            href="/materialy/add"
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
          >
            Nový materiál
          </Link>
        )}
        <Link
          href="/materialy/settings"
          className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
        >
          Podtypy materiálu
        </Link>
        <Link
          href="/iml/settings"
          className="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
        >
          <FileWarning className="h-4 w-4" />
          IML – fólie a PANTONE
        </Link>
      </div>
    </>
  );
}

