import Link from "next/link";
import { redirect } from "next/navigation";
import { Layers } from "lucide-react";
import { auth } from "@/auth";
import { hasModuleAccess } from "@/lib/auth-utils";
import { prisma } from "@/lib/db";
import { ResyncProductsButton } from "./ResyncProductsButton";
import { VysekyWorkflowNav } from "./VysekyWorkflowNav";

export default async function ImVysekyHubPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const userId = parseInt(session.user.id, 10);
  if (!(await hasModuleAccess(userId, "iml", "read"))) redirect("/iml");

  const [shapesCount, toolsCount, impositionsCount] = await Promise.all([
    prisma.iml_shape_catalog.count(),
    prisma.iml_tool_catalog.count(),
    prisma.iml_imposition_catalog.count(),
  ]);

  return (
    <div className="space-y-8">
      <div>
        <Link href="/iml" className="text-sm text-violet-700 hover:underline">
          ← IML
        </Link>
        <h1 className="mt-2 flex items-center gap-2 text-2xl font-bold text-gray-900">
          <Layers className="h-7 w-7 text-red-600" />
          Výseky
        </h1>
        <p className="mt-1 max-w-2xl text-gray-600">
          Vyplňujte v tomto pořadí — každý krok potřebuje data z předchozího:{" "}
          <span className="font-medium text-gray-800">
            tvar → nástroj → montáž
          </span>
          .
        </p>
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
          Postup vyplnění
        </h2>
        <VysekyWorkflowNav variant="hub" />
      </section>

      <section className="grid gap-3 sm:grid-cols-3">
        <Link
          href="/iml/shapes"
          className="rounded-lg border border-gray-200 bg-white px-4 py-3 text-center shadow-sm hover:border-violet-200"
        >
          <p className="text-2xl font-bold text-gray-900">{shapesCount}</p>
          <p className="text-xs text-gray-500">tvarů v katalogu</p>
        </Link>
        <Link
          href="/iml/tools"
          className="rounded-lg border border-gray-200 bg-white px-4 py-3 text-center shadow-sm hover:border-violet-200"
        >
          <p className="text-2xl font-bold text-gray-900">{toolsCount}</p>
          <p className="text-xs text-gray-500">nástrojů (želez)</p>
        </Link>
        <Link
          href="/iml/impositions"
          className="rounded-lg border border-gray-200 bg-white px-4 py-3 text-center shadow-sm hover:border-violet-200"
        >
          <p className="text-2xl font-bold text-gray-900">{impositionsCount}</p>
          <p className="text-xs text-gray-500">montáží</p>
        </Link>
      </section>

      <section className="rounded-xl border border-gray-200 bg-gray-50 p-4">
        <h2 className="text-sm font-semibold text-gray-800">Hromadné akce</h2>
        <p className="mt-1 text-xs text-gray-500">
          Import a přepočet produktů — až po založení základních záznamů.
        </p>
        <div className="mt-3 flex flex-wrap items-start gap-3 text-sm">
          <Link
            href="/iml/shapes/import"
            className="rounded-lg border border-violet-300 bg-violet-50 px-3 py-1.5 font-medium text-violet-900 hover:bg-violet-100"
          >
            Import tvarů a nástrojů
          </Link>
          <Link
            href="/iml/tools/import"
            className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-gray-800 hover:bg-gray-50"
          >
            Import jen nástrojů
          </Link>
          <ResyncProductsButton />
        </div>
      </section>
    </div>
  );
}
