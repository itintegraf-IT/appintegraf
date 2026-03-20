import Link from "next/link";
import { prisma } from "@/lib/db";
import { Tv, Plus, Eye, Pencil } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function KioskPage() {
  const presentations = await prisma.presentations.findMany({
    where: { is_active: true },
    orderBy: { name: "asc" },
    take: 50,
  });

  type PresentationRow = { id: number; name: string; description: string | null; created_at: Date };
  const presentationsTyped = presentations as PresentationRow[];

  return (
    <>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900">
            <Tv className="h-7 w-7 text-red-600" />
            Kiosk Monitory
          </h1>
          <p className="mt-1 text-gray-600">Správa prezentací pro monitory</p>
        </div>
        <Link
          href="/kiosk/create"
          className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 font-medium text-white hover:bg-red-700"
        >
          <Plus className="h-4 w-4" />
          Nová prezentace
        </Link>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-gray-200 bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Název</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Popis</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Status</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Vytvořeno</th>
                <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">Akce</th>
              </tr>
            </thead>
            <tbody>
              {presentationsTyped.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                    Žádné prezentace
                  </td>
                </tr>
              ) : (
                presentationsTyped.map((p) => (
                  <tr key={p.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">{p.name}</td>
                    <td className="px-4 py-3 text-gray-600">{p.description ?? "-"}</td>
                    <td className="px-4 py-3">
                      <span className="rounded bg-green-100 px-2 py-0.5 text-sm text-green-700">
                        Aktivní
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {new Date(p.created_at).toLocaleDateString("cs-CZ")}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link href={`/kiosk/${p.id}`} className="mr-2 rounded p-2 text-gray-600 hover:bg-gray-100">
                        <Eye className="inline h-4 w-4" />
                      </Link>
                      <Link href={`/kiosk/${p.id}/edit`} className="rounded p-2 text-gray-600 hover:bg-gray-100">
                        <Pencil className="inline h-4 w-4" />
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
