import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/auth-utils";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { Mail, Plus, ArrowLeft, Pencil } from "lucide-react";
import { DeleteSharedMailButton } from "./DeleteSharedMailButton";

export default async function AdminSharedMailsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const userId = parseInt(session.user.id, 10);
  if (!(await isAdmin(userId))) {
    redirect("/contacts?error=Nemáte oprávnění");
  }

  const rows = await prisma.shared_mails.findMany({
    orderBy: [{ sort_order: "asc" }, { label: "asc" }],
    include: {
      _count: { select: { user_shared_mails: true } },
    },
  });

  return (
    <>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900">
            <Mail className="h-7 w-7 text-red-600" />
            Společné maily
          </h1>
          <p className="mt-1 text-gray-600">Sdílené e-mailové schránky a přiřazení uživatelům (úprava u uživatele)</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/admin"
            className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-gray-700 shadow-sm hover:bg-gray-50"
          >
            <ArrowLeft className="h-4 w-4" />
            Administrace
          </Link>
          <Link
            href="/admin/shared-mails/new"
            className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-white shadow-sm hover:bg-red-700"
          >
            <Plus className="h-4 w-4" />
            Přidat
          </Link>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="border-b border-gray-200 bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left font-semibold text-gray-700">E-mail</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-700">Název</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-700">Řaz.</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-700">Aktivní</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-700">Uživatelé</th>
              <th className="px-4 py-3 text-right font-semibold text-gray-700">Akce</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                  Zatím žádné záznamy
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-2 font-mono text-xs">{r.email}</td>
                  <td className="px-4 py-2 font-medium text-gray-900">{r.label}</td>
                  <td className="px-4 py-2 text-gray-600">{r.sort_order ?? 0}</td>
                  <td className="px-4 py-2">{r.is_active === false ? "ne" : "ano"}</td>
                  <td className="px-4 py-2 text-gray-600">{r._count.user_shared_mails}</td>
                  <td className="px-4 py-2 text-right">
                    <div className="flex justify-end gap-1">
                      <Link
                        href={`/admin/shared-mails/${r.id}/edit`}
                        className="rounded p-2 text-gray-600 hover:bg-gray-100"
                        title="Upravit"
                      >
                        <Pencil className="h-4 w-4" />
                      </Link>
                      <DeleteSharedMailButton id={r.id} label={r.label} />
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
