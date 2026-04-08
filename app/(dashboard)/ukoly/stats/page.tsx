import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { getUserDepartmentIds } from "@/lib/ukoly-recipients";
import { ukolStatusLabel } from "@/lib/ukoly-status";

export const dynamic = "force-dynamic";

export default async function UkolyStatsPage() {
  const session = await auth();
  const userId = session?.user?.id ? parseInt(session.user.id, 10) : 0;
  const deptIds = await getUserDepartmentIds(userId);
  const visibilityOr: Record<string, unknown>[] = [
    { created_by: userId },
    { assignee_user_id: userId },
  ];
  if (deptIds.length > 0) {
    visibilityOr.push({
      ukoly_departments: { some: { department_id: { in: deptIds } } },
    });
  }

  const rows = await prisma.ukoly.findMany({
    where: { OR: visibilityOr },
    include: {
      ukoly_departments: { include: { departments: { select: { id: true, name: true } } } },
    },
    take: 1000,
    orderBy: { due_at: "asc" },
  });

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfToday = new Date(startOfToday);
  endOfToday.setHours(23, 59, 59, 999);
  const in7 = new Date(startOfToday);
  in7.setDate(in7.getDate() + 7);
  in7.setHours(23, 59, 59, 999);

  const total = rows.length;
  const open = rows.filter((r) => r.status === "open").length;
  const inProgress = rows.filter((r) => r.status === "in_progress").length;
  const done = rows.filter((r) => r.status === "done").length;
  const cancelled = rows.filter((r) => r.status === "cancelled").length;
  const overdue = rows.filter((r) => r.status !== "done" && r.status !== "cancelled" && new Date(r.due_at) < now).length;
  const dueToday = rows.filter((r) => new Date(r.due_at) >= startOfToday && new Date(r.due_at) <= endOfToday).length;
  const dueWeek = rows.filter((r) => new Date(r.due_at) >= startOfToday && new Date(r.due_at) <= in7).length;
  const urgent = rows.filter((r) => r.urgent).length;

  const doneInTime = rows.filter((r) => r.status === "done" && new Date(r.updated_at) <= new Date(r.due_at)).length;
  const doneLate = rows.filter((r) => r.status === "done" && new Date(r.updated_at) > new Date(r.due_at)).length;
  const doneTotal = doneInTime + doneLate;
  const sla = doneTotal > 0 ? Math.round((doneInTime / doneTotal) * 100) : 0;

  const byStatus = [
    { key: "open", label: ukolStatusLabel("open"), count: open },
    { key: "in_progress", label: ukolStatusLabel("in_progress"), count: inProgress },
    { key: "done", label: ukolStatusLabel("done"), count: done },
    { key: "cancelled", label: ukolStatusLabel("cancelled"), count: cancelled },
  ];

  const departmentMap = new Map<number, { name: string; count: number }>();
  for (const r of rows) {
    for (const d of r.ukoly_departments) {
      const prev = departmentMap.get(d.department_id);
      if (prev) {
        prev.count += 1;
      } else {
        departmentMap.set(d.department_id, { name: d.departments.name, count: 1 });
      }
    }
  }
  const topDepartments = [...departmentMap.entries()]
    .map(([id, item]) => ({ id, ...item }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  const nearestDeadlines = rows
    .filter((r) => r.status !== "done" && r.status !== "cancelled")
    .slice(0, 8);

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Celkem úkolů" value={String(total)} />
        <StatCard title="Po termínu" value={String(overdue)} danger />
        <StatCard title="Dnes k řešení" value={String(dueToday)} />
        <StatCard title="Do 7 dní" value={String(dueWeek)} />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Urgentní" value={String(urgent)} />
        <StatCard title="SLA (včas hotovo)" value={`${sla}%`} />
        <StatCard title="Hotovo včas" value={String(doneInTime)} />
        <StatCard title="Hotovo po termínu" value={String(doneLate)} />
      </div>

      <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <h3 className="mb-3 text-sm font-semibold text-gray-700">Rozpad podle stavu</h3>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {byStatus.map((s) => (
            <div key={s.key} className="rounded-lg border border-gray-200 p-3">
              <p className="text-xs uppercase text-gray-500">{s.label}</p>
              <p className="mt-1 text-xl font-semibold text-gray-900">{s.count}</p>
            </div>
          ))}
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <h3 className="mb-3 text-sm font-semibold text-gray-700">Top oddělení podle počtu úkolů</h3>
          {topDepartments.length === 0 ? (
            <p className="text-sm text-gray-500">Bez dat</p>
          ) : (
            <ul className="space-y-2">
              {topDepartments.map((d) => (
                <li key={d.id} className="flex items-center justify-between rounded-lg border border-gray-100 px-3 py-2">
                  <span className="text-sm text-gray-700">{d.name}</span>
                  <span className="rounded bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">{d.count}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <h3 className="mb-3 text-sm font-semibold text-gray-700">Nejbližší termíny (aktivní úkoly)</h3>
          {nearestDeadlines.length === 0 ? (
            <p className="text-sm text-gray-500">Bez aktivních úkolů.</p>
          ) : (
            <ul className="space-y-2">
              {nearestDeadlines.map((r) => (
                <li key={r.id} className="rounded-lg border border-gray-100 px-3 py-2">
                  <div className="flex items-center justify-between gap-3">
                    <span className="truncate text-sm text-gray-800">
                      #{r.id} {r.order_number ? `· ${r.order_number}` : ""} {r.body.replace(/\s+/g, " ").trim().slice(0, 40)}
                    </span>
                    <span className="shrink-0 text-xs text-gray-500">
                      {new Date(r.due_at).toLocaleString("cs-CZ", {
                        day: "2-digit",
                        month: "2-digit",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

function StatCard({ title, value, danger = false }: { title: string; value: string; danger?: boolean }) {
  return (
    <div className={`rounded-xl border bg-white p-4 shadow-sm ${danger ? "border-red-200" : "border-gray-200"}`}>
      <p className="text-xs uppercase text-gray-500">{title}</p>
      <p className={`mt-1 text-2xl font-semibold ${danger ? "text-red-700" : "text-gray-900"}`}>{value}</p>
    </div>
  );
}
