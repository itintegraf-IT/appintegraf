import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/auth-utils";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { Building2, Plus, ArrowLeft, Pencil } from "lucide-react";

export default async function AdminDepartmentsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const userId = parseInt(session.user.id, 10);
  if (!(await isAdmin(userId))) {
    redirect("/contacts?error=Nemáte oprávnění");
  }

  const departments = await prisma.departments.findMany({
    orderBy: { name: "asc" },
    include: {
      users: { select: { first_name: true, last_name: true } },
    },
  });

  return (
    <>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900">
            <Building2 className="h-7 w-7 text-red-600" />
            Správa oddělení
          </h1>
          <p className="mt-1 text-gray-600">Přehled a úprava oddělení</p>
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
            href="/admin/departments/add"
            className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 font-medium text-white hover:bg-red-700"
          >
            <Plus className="h-4 w-4" />
            Přidat oddělení
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
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Vedoucí</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Telefon</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Status</th>
                <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">Akce</th>
              </tr>
            </thead>
            <tbody>
              {departments.map((d) => (
                <tr key={d.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{d.name}</td>
                  <td className="px-4 py-3">{d.code ?? "-"}</td>
                  <td className="px-4 py-3">
                    {d.users ? `${d.users.first_name} ${d.users.last_name}` : "-"}
                  </td>
                  <td className="px-4 py-3">{d.phone ?? "-"}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded px-2 py-0.5 text-sm ${
                        d.is_active ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                      }`}
                    >
                      {d.is_active ? "Aktivní" : "Neaktivní"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/admin/departments/${d.id}/edit`}
                      className="rounded p-2 text-gray-600 hover:bg-gray-100"
                    >
                      <Pencil className="inline h-4 w-4" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
