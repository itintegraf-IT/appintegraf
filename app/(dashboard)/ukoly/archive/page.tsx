import Link from "next/link";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { getUserDepartmentIds } from "@/lib/ukoly-recipients";
import { ukolStatusBadgeClass, ukolStatusLabel } from "@/lib/ukoly-status";

export const dynamic = "force-dynamic";

export default async function UkolyArchivePage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; term?: string }>;
}) {
  const session = await auth();
  const userId = session?.user?.id ? parseInt(session.user.id, 10) : 0;
  const params = await searchParams;
  const deptIds = await getUserDepartmentIds(userId);
  const or: Record<string, unknown>[] = [{ created_by: userId }, { assignee_user_id: userId }];
  if (deptIds.length > 0) {
    or.push({ ukoly_departments: { some: { department_id: { in: deptIds } } } });
  }

  const selectedStatus = params.status === "done" || params.status === "cancelled" ? params.status : "";
  const selectedTerm = params.term === "month" || params.term === "quarter" ? params.term : "";
  const exportQuery = new URLSearchParams();
  if (selectedStatus) exportQuery.set("status", selectedStatus);
  if (selectedTerm) exportQuery.set("term", selectedTerm);
  const now = new Date();
  const where: Record<string, unknown> = {
    OR: or,
    status: selectedStatus || { in: ["done", "cancelled"] },
  };
  if (selectedTerm === "month") {
    const monthAgo = new Date(now);
    monthAgo.setMonth(monthAgo.getMonth() - 1);
    where.updated_at = { gte: monthAgo };
  } else if (selectedTerm === "quarter") {
    const qAgo = new Date(now);
    qAgo.setMonth(qAgo.getMonth() - 3);
    where.updated_at = { gte: qAgo };
  }

  const rows = await prisma.ukoly.findMany({
    where,
    orderBy: { updated_at: "desc" },
    take: 300,
    include: {
      users_assignee: { select: { first_name: true, last_name: true } },
      ukoly_departments: { include: { departments: { select: { name: true } } } },
    },
  });

  return (
    <div className="space-y-4">
      <form className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <label className="mb-1 block text-xs font-medium uppercase text-gray-500">Stav</label>
            <select name="status" defaultValue={selectedStatus} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm">
              <option value="">Vše v archivu</option>
              <option value="done">{ukolStatusLabel("done")}</option>
              <option value="cancelled">{ukolStatusLabel("cancelled")}</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium uppercase text-gray-500">Období</label>
            <select name="term" defaultValue={selectedTerm} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm">
              <option value="">Bez omezení</option>
              <option value="month">Poslední měsíc</option>
              <option value="quarter">Poslední 3 měsíce</option>
            </select>
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <button type="submit" className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700">
              Filtrovat
            </button>
            <Link href="/ukoly/archive" className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
              Reset
            </Link>
            <a
              href={`/api/ukoly/archive/export?format=csv${exportQuery.toString() ? `&${exportQuery.toString()}` : ""}`}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
            >
              Export CSV
            </a>
            <a
              href={`/api/ukoly/archive/export?format=xlsx${exportQuery.toString() ? `&${exportQuery.toString()}` : ""}`}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
            >
              Export XLSX
            </a>
          </div>
        </div>
      </form>

      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-gray-200 bg-gray-50">
            <tr>
              <th className="px-4 py-3 font-semibold text-gray-700">Dokončeno / změněno</th>
              <th className="px-4 py-3 font-semibold text-gray-700">Zakázka</th>
              <th className="px-4 py-3 font-semibold text-gray-700">Úkol</th>
              <th className="px-4 py-3 font-semibold text-gray-700">Přiřazeno</th>
              <th className="px-4 py-3 font-semibold text-gray-700">Oddělení</th>
              <th className="px-4 py-3 font-semibold text-gray-700">Stav</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-gray-500">
                  Archiv je prázdný.
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id} className="border-b border-gray-100 hover:bg-gray-50/80">
                  <td className="px-4 py-3 text-gray-800">
                    {new Date(r.updated_at).toLocaleString("cs-CZ", {
                      day: "2-digit",
                      month: "2-digit",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </td>
                  <td className="px-4 py-3 text-gray-700">{r.order_number ?? "—"}</td>
                  <td className="max-w-xs px-4 py-3">
                    <Link href={`/ukoly/${r.id}`} className="font-medium text-red-600 hover:underline">
                      {r.body.replace(/\s+/g, " ").trim().slice(0, 80)}
                      {r.body.length > 80 ? "…" : ""}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-gray-700">
                    {r.users_assignee ? `${r.users_assignee.first_name} ${r.users_assignee.last_name}` : "—"}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{r.ukoly_departments.map((x) => x.departments.name).join(", ") || "—"}</td>
                  <td className="px-4 py-3 text-gray-700">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${ukolStatusBadgeClass(r.status)}`}>
                      {ukolStatusLabel(r.status)}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
