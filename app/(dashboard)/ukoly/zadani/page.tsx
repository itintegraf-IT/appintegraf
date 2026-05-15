import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { hasModuleAccess } from "@/lib/auth-utils";
import { getUserDepartmentIds } from "@/lib/ukoly-recipients";
import { canViewAllUkoly } from "@/lib/ukoly-access";
import { formatDateTimeCz } from "@/lib/datetime-cz";
import { ukolStatusBadgeClass, ukolStatusLabel } from "@/lib/ukoly-status";

export const dynamic = "force-dynamic";

export default async function UkolyZadaniPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; dept?: string; term?: string }>;
}) {
  const session = await auth();
  const userId = session?.user?.id ? parseInt(session.user.id, 10) : 0;
  if (!(await hasModuleAccess(userId, "ukoly", "write"))) {
    redirect("/ukoly");
  }

  const params = await searchParams;
  const orgWide = await canViewAllUkoly(userId);
  const deptIds = await getUserDepartmentIds(userId);
  const myDepartments =
    deptIds.length > 0
      ? await prisma.departments.findMany({
          where: { id: { in: deptIds } },
          select: { id: true, name: true },
          orderBy: { name: "asc" },
        })
      : [];

  const filterDepartments = orgWide
    ? await prisma.departments.findMany({
        where: { is_active: true, display_in_list: true },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      })
    : myDepartments;

  const selectedStatus =
    params.status === "open" || params.status === "in_progress" || params.status === "done" || params.status === "cancelled"
      ? params.status
      : "";
  const selectedDept = params.dept ? parseInt(params.dept, 10) : NaN;
  const selectedTerm = params.term === "overdue" || params.term === "today" || params.term === "week" ? params.term : "";
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfToday = new Date(startOfToday);
  endOfToday.setHours(23, 59, 59, 999);
  const endOfWeek = new Date(startOfToday);
  endOfWeek.setDate(endOfWeek.getDate() + 7);
  endOfWeek.setHours(23, 59, 59, 999);

  const where: Record<string, unknown> = orgWide ? {} : { created_by: userId };
  if (selectedStatus) {
    where.status = selectedStatus;
  } else {
    where.status = { notIn: ["done", "cancelled"] };
  }
  if (!Number.isNaN(selectedDept)) {
    where.ukoly_departments = { some: { department_id: selectedDept } };
  }
  if (selectedTerm === "overdue") {
    where.due_at = { lt: now };
  } else if (selectedTerm === "today") {
    where.due_at = { gte: startOfToday, lte: endOfToday };
  } else if (selectedTerm === "week") {
    where.due_at = { gte: startOfToday, lte: endOfWeek };
  }

  const rows = await prisma.ukoly.findMany({
    where,
    orderBy: { due_at: "asc" },
    take: 200,
    include: {
      users_assignee: { select: { first_name: true, last_name: true } },
      users_creator: { select: { first_name: true, last_name: true } },
      ukoly_departments: { include: { departments: { select: { name: true } } } },
    },
  });

  const statusOrder = ["open", "in_progress", "done", "cancelled"] as const;
  const grouped = statusOrder.map((status) => ({
    status,
    label: ukolStatusLabel(status),
    items: rows.filter((r) => r.status === status),
  }));

  const deptLabel = orgWide ? "Všechna oddělení" : "Všechna moje oddělení";
  const colCount = orgWide ? 7 : 6;

  return (
    <div className="space-y-5">
      <p className="text-sm text-gray-600">
        {orgWide
          ? "Přehled všech úkolů ve firmě včetně přiřazení a stavu plnění."
          : "Úkoly, které jste zadal(a) — stav plnění u přiřazených zaměstnanců a oddělení."}
      </p>

      <form method="get" action="/ukoly/zadani" className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className="mb-1 block text-xs font-medium uppercase text-gray-500">Stav</label>
            <select
              name="status"
              defaultValue={selectedStatus}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="">Aktivní (bez zrušených)</option>
              <option value="open">{ukolStatusLabel("open")}</option>
              <option value="in_progress">{ukolStatusLabel("in_progress")}</option>
              <option value="done">{ukolStatusLabel("done")}</option>
              <option value="cancelled">{ukolStatusLabel("cancelled")}</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium uppercase text-gray-500">Oddělení</label>
            <select
              name="dept"
              defaultValue={!Number.isNaN(selectedDept) ? String(selectedDept) : ""}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="">{deptLabel}</option>
              {filterDepartments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium uppercase text-gray-500">Termín</label>
            <select name="term" defaultValue={selectedTerm} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm">
              <option value="">Bez omezení</option>
              <option value="overdue">Po termínu</option>
              <option value="today">Dnes</option>
              <option value="week">Do 7 dní</option>
            </select>
          </div>
          <div className="flex items-end gap-2">
            <button type="submit" className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700">
              Filtrovat
            </button>
            <Link href="/ukoly/zadani" className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
              Reset
            </Link>
          </div>
        </div>
      </form>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {grouped.map((g) => (
          <div key={g.status} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="mb-2 flex items-center justify-between">
              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${ukolStatusBadgeClass(g.status)}`}>
                {g.label}
              </span>
              <span className="text-sm font-semibold text-gray-700">{g.items.length}</span>
            </div>
            <div className="space-y-1">
              {g.items.slice(0, 3).map((r) => (
                <Link key={r.id} href={`/ukoly/${r.id}`} className="block truncate text-sm text-gray-700 hover:text-red-600">
                  #{r.id} {r.order_number ? `· ${r.order_number}` : ""} {r.body.replace(/\s+/g, " ").trim().slice(0, 28)}
                </Link>
              ))}
              {g.items.length === 0 && <p className="text-xs text-gray-400">Bez úkolů</p>}
            </div>
          </div>
        ))}
      </section>

      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-gray-200 bg-gray-50">
            <tr>
              <th className="px-4 py-3 font-semibold text-gray-700">Termín</th>
              <th className="px-4 py-3 font-semibold text-gray-700">Zakázka</th>
              <th className="px-4 py-3 font-semibold text-gray-700">Úkol</th>
              {orgWide && <th className="px-4 py-3 font-semibold text-gray-700">Zadavatel</th>}
              <th className="px-4 py-3 font-semibold text-gray-700">Přiřazeno</th>
              <th className="px-4 py-3 font-semibold text-gray-700">Oddělení</th>
              <th className="px-4 py-3 font-semibold text-gray-700">Stav</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={colCount} className="px-4 py-10 text-center text-gray-500">
                  Žádné úkoly k zobrazení.
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id} className="border-b border-gray-100 hover:bg-gray-50/80">
                  <td className="px-4 py-3 text-gray-800">
                    {formatDateTimeCz(new Date(r.due_at))}
                    {r.urgent && (
                      <span className="ml-2 rounded bg-amber-100 px-1.5 text-xs text-amber-900">
                        urgentní
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-700">{r.order_number ?? "—"}</td>
                  <td className="max-w-xs px-4 py-3">
                    <Link href={`/ukoly/${r.id}`} className="font-medium text-red-600 hover:underline">
                      {r.body.replace(/\s+/g, " ").trim().slice(0, 80)}
                      {r.body.length > 80 ? "…" : ""}
                    </Link>
                  </td>
                  {orgWide && (
                    <td className="px-4 py-3 text-gray-700">
                      {r.users_creator
                        ? `${r.users_creator.first_name} ${r.users_creator.last_name}`
                        : "—"}
                    </td>
                  )}
                  <td className="px-4 py-3 text-gray-700">
                    {r.users_assignee
                      ? `${r.users_assignee.first_name} ${r.users_assignee.last_name}`
                      : "—"}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {r.ukoly_departments.map((x) => x.departments.name).join(", ") || "—"}
                  </td>
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
