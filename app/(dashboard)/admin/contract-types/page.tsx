import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/auth-utils";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { FileText, Plus, ArrowLeft, Pencil } from "lucide-react";
import { normalizeContractResolver } from "@/lib/contracts/resolveApprovers";
import { getContractResolverSettingsForAdmin } from "@/lib/contracts/contract-resolver-settings";
import { ContractResolverSettingsPanel } from "./ContractResolverSettingsPanel";

export default async function AdminContractTypesPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const userId = parseInt(session.user.id, 10);
  if (!(await isAdmin(userId))) {
    redirect("/contacts?error=Nemáte oprávnění");
  }

  const [types, resolverSettings] = await Promise.all([
    prisma.contract_types.findMany({
      orderBy: [{ sort_order: "asc" }, { name: "asc" }],
      include: {
        contract_workflow_steps: {
          orderBy: { step_order: "asc" },
          select: { id: true, step_order: true, resolver: true },
        },
        _count: { select: { contracts: true } },
      },
    }),
    getContractResolverSettingsForAdmin(),
  ]);

  return (
    <>
      <ContractResolverSettingsPanel initial={resolverSettings} />

      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900">
            <FileText className="h-7 w-7 text-red-600" />
            Typy smluv a šablony schvalování
          </h1>
          <p className="mt-1 text-gray-600">
            Číselník typů a pořadí kroků (resolvery) pro modul Evidence smluv
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/admin"
            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50"
          >
            <ArrowLeft className="h-4 w-4" />
            Zpět
          </Link>
          <Link
            href="/admin/contract-types/new"
            className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 font-medium text-white hover:bg-red-700"
          >
            <Plus className="h-4 w-4" />
            Nový typ
          </Link>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-gray-200 bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Název</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Kód</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Kroky</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Smluv</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Stav</th>
                <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">Akce</th>
              </tr>
            </thead>
            <tbody>
              {types.map((t) => (
                <tr key={t.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{t.name}</td>
                  <td className="px-4 py-3">{t.code ?? "—"}</td>
                  <td className="max-w-md px-4 py-3 text-sm text-gray-600">
                    {t.contract_workflow_steps.length === 0 ? (
                      <span className="text-amber-600">bez kroků</span>
                    ) : (
                      <span className="line-clamp-2">
                        {t.contract_workflow_steps
                          .map((s) => `${s.step_order}. ${normalizeContractResolver(s.resolver)}`)
                          .join(" → ")}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">{t._count.contracts}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded px-2 py-0.5 text-sm ${
                        t.is_active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {t.is_active ? "aktivní" : "neaktivní"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/admin/contract-types/${t.id}/edit`}
                      className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
                    >
                      <Pencil className="h-4 w-4" />
                      Upravit
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {types.length === 0 && (
          <p className="px-4 py-8 text-center text-gray-500">
            Zatím žádný typ.{" "}
            <Link href="/admin/contract-types/new" className="text-red-600 underline">
              Vytvořte první
            </Link>
            .
          </p>
        )}
      </div>
    </>
  );
}
