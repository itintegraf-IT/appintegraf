import { prisma } from "@/lib/db";
import { crmUserDisplayName } from "@/lib/crm/users";

export async function ActivitiesPerRepWidget() {
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const grouped = await prisma.crm_activities.groupBy({
    by: ["owner_id"],
    where: { created_at: { gte: since } },
    _count: { _all: true },
  });

  const users = await prisma.users.findMany({
    where: { OR: [{ is_active: true }, { is_active: null }] },
    select: { id: true, first_name: true, last_name: true, email: true },
    orderBy: [{ last_name: "asc" }, { first_name: "asc" }],
  });

  const byOwner = new Map(grouped.map((g) => [g.owner_id, g._count._all]));
  const rows = users
    .map((u) => ({
      id: u.id,
      label: crmUserDisplayName(u),
      count: byOwner.get(u.id) ?? 0,
    }))
    .sort((a, b) => b.count - a.count);

  const total = rows.reduce((acc, r) => acc + r.count, 0);
  const max = Math.max(1, ...rows.map((r) => r.count));

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-[13px] font-semibold tracking-tight text-gray-900">Aktivity týmu</h3>
        <span className="text-xs text-gray-500">posledních 7 dní · {total} celkem</span>
      </div>
      <ul className="space-y-2">
        {rows.map((r) => (
          <li key={r.id} className="flex items-center gap-3 text-sm">
            <span className="w-36 truncate text-gray-900">{r.label}</span>
            <div className="relative h-2 flex-1 overflow-hidden rounded-full bg-gray-100">
              <div
                className="h-full rounded-full bg-red-600/80"
                style={{ width: `${(r.count / max) * 100}%` }}
                aria-hidden
              />
            </div>
            <span className="w-8 text-right font-medium tabular-nums">{r.count}</span>
          </li>
        ))}
        {rows.length === 0 ? (
          <li className="text-sm text-gray-500">Žádní aktivní uživatelé.</li>
        ) : null}
      </ul>
    </div>
  );
}
