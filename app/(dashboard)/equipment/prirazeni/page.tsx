import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { hasModuleAccess, isAdmin } from "@/lib/auth-utils";
import { prisma } from "@/lib/db";
import { Laptop, Printer, FileText, ArrowLeft } from "lucide-react";

export default async function EquipmentPrirazeniPage() {
  const session = await auth();
  const userId = session?.user?.id ? parseInt(session.user.id, 10) : 0;
  if (!(await hasModuleAccess(userId, "equipment", "read"))) notFound();

  const seeAll =
    (await isAdmin(userId)) || (await hasModuleAccess(userId, "equipment", "write"));

  const rows = await prisma.equipment_assignments.findMany({
    where: {
      returned_at: null,
      ...(seeAll ? {} : { user_id: userId }),
    },
    orderBy: [{ assigned_at: "desc" }],
    include: {
      users_equipment_assignments_user_idTousers: {
        select: {
          first_name: true,
          last_name: true,
          position: true,
          department_name: true,
        },
      },
      equipment_items: {
        select: {
          id: true,
          name: true,
          brand: true,
          model: true,
          serial_number: true,
        },
      },
    },
  });

  const formatDate = (d: Date) => new Date(d).toLocaleDateString("cs-CZ");

  return (
    <>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900">
            <Laptop className="h-7 w-7 text-red-600" />
            Přiřazení majetku
          </h1>
          <p className="mt-1 text-gray-600">
            {seeAll
              ? "Všechna aktivní přiřazení – tisk předávacího protokolu a protokolu o vrácení"
              : "Vaše aktivní přiřazení – tisk protokolů"}
          </p>
        </div>
        <Link
          href="/equipment?scope=all"
          className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
        >
          <ArrowLeft className="h-4 w-4" />
          Evidence vybavení
        </Link>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-600">
          Aktivních přiřazení: <strong>{rows.length}</strong>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-gray-200 bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Zaměstnanec</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Vybavení</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Sériové č.</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Předáno</th>
                <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">Protokoly</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-gray-500">
                    Žádná aktivní přiřazení – veškerý majetek je na skladě.
                  </td>
                </tr>
              ) : (
                rows.map((a) => {
                  const u = a.users_equipment_assignments_user_idTousers;
                  const e = a.equipment_items;
                  const name = u ? `${u.last_name} ${u.first_name}` : "—";
                  return (
                    <tr key={a.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900">{name}</div>
                        {u?.position && (
                          <div className="text-xs text-gray-500">{u.position}</div>
                        )}
                        {u?.department_name && (
                          <div className="text-xs text-gray-500">{u.department_name}</div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <Link
                          href={`/equipment/${e.id}`}
                          className="font-medium text-red-700 hover:underline"
                        >
                          {e.name}
                        </Link>
                        <div className="text-xs text-gray-500">
                          {[e.brand, e.model].filter(Boolean).join(" ") || "—"}
                        </div>
                      </td>
                      <td className="px-4 py-3 font-mono text-sm">{e.serial_number ?? "—"}</td>
                      <td className="px-4 py-3 text-sm">{formatDate(a.assigned_at)}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap items-center justify-end gap-2">
                          <Link
                            href={`/equipment/protokol/predani?assignmentId=${a.id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 rounded border border-gray-200 bg-white px-2 py-1 text-xs font-medium text-gray-800 hover:bg-gray-50"
                            title="Předávací protokol"
                          >
                            <Printer className="h-3.5 w-3.5" />
                            Předání
                          </Link>
                          <Link
                            href={`/equipment/protokol/vraceni?assignmentId=${a.id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 rounded border border-gray-200 bg-white px-2 py-1 text-xs font-medium text-gray-800 hover:bg-gray-50"
                            title="Protokol o vrácení"
                          >
                            <FileText className="h-3.5 w-3.5" />
                            Vrácení
                          </Link>
                          <Link
                            href={`/equipment/${e.id}`}
                            className="text-xs text-gray-500 hover:text-gray-800"
                          >
                            Detail
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
