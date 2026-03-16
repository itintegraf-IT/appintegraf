import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { isAdmin } from "@/lib/auth-utils";
import { ArrowLeft, Shield } from "lucide-react";

export default async function AdminRolesPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const userId = parseInt(session.user.id, 10);
  if (!(await isAdmin(userId))) {
    redirect("/admin?error=Nemáte oprávnění");
  }

  const roles = await prisma.roles.findMany({
    orderBy: { name: "asc" },
    include: {
      _count: { select: { user_roles: true } },
    },
  });

  return (
    <>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900">
            <Shield className="h-7 w-7 text-red-600" />
            Role
          </h1>
          <p className="mt-1 text-gray-600">Přehled rolí a oprávnění</p>
        </div>
        <Link
          href="/admin"
          className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50"
        >
          <ArrowLeft className="h-4 w-4" />
          Zpět
        </Link>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-gray-200 bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Název</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Popis</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Uživatelé</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Stav</th>
              </tr>
            </thead>
            <tbody>
              {roles.map((r) => (
                <tr key={r.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{r.name}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{r.description ?? "-"}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {r._count.user_roles ?? 0}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                        r.is_active !== false ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {r.is_active !== false ? "Aktivní" : "Neaktivní"}
                    </span>
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
