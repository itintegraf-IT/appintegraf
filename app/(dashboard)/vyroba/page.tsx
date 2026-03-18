import { auth } from "@/auth";
import { hasModuleAccess } from "@/lib/auth-utils";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Factory, Settings } from "lucide-react";
import { JOB_TYPES } from "@/lib/vyroba/config/fix-settings";

export default async function VyrobaPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const userId = parseInt(session.user.id, 10);
  const canRead = await hasModuleAccess(userId, "vyroba", "read");
  const canWrite = await hasModuleAccess(userId, "vyroba", "write");

  if (!canRead) {
    redirect("/");
  }

  const defaultJob = JOB_TYPES[0];

  return (
    <>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900">
            <Factory className="h-7 w-7 text-amber-600" />
            Výroba
          </h1>
          <p className="mt-1 text-gray-600">
            Generování dat pro tiskárny, kontrola balení a protokoly
          </p>
        </div>
        {canWrite && (
          <Link
            href="/vyroba/nastaveni"
            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50"
          >
            <Settings className="h-4 w-4" />
            Nastavení
          </Link>
        )}
      </div>

      <Link
        href={`/vyroba/${defaultJob}`}
        className="flex items-center gap-4 rounded-xl border border-gray-200 bg-white p-6 shadow-sm transition-colors hover:border-amber-200 hover:bg-amber-50/50"
      >
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-600">
          <Factory className="h-6 w-6" />
        </div>
        <div>
          <p className="font-semibold text-gray-900">Parametry výroby</p>
          <p className="mt-0.5 text-sm text-gray-500">
            Nastavení parametrů, TISK a ŘEZÁNÍ – typ výroby vyberete v poli JOB
          </p>
        </div>
      </Link>
    </>
  );
}
