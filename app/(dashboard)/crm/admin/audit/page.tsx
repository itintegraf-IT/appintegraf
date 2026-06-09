import { prisma } from "@/lib/db";
import { UserAvatar } from "@/components/crm/UserAvatar";
import { crmUserDisplayName } from "@/lib/crm/users";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

function fmt(d: Date): string {
  return new Intl.DateTimeFormat("cs-CZ", {
    timeZone: "Europe/Prague",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

const ACTION_COLOR: Record<string, string> = {
  CREATE: "bg-emerald-100 text-emerald-700",
  UPDATE: "bg-sky-100 text-sky-700",
  DELETE: "bg-rose-100 text-rose-700",
};

export default async function AdminAuditPage() {
  const logs = await prisma.crm_audit_log.findMany({
    orderBy: [{ created_at: "desc" }, { id: "desc" }],
    take: 100,
    include: {
      user: { select: { id: true, first_name: true, last_name: true, email: true } },
    },
  });

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-xl font-semibold text-gray-900">Audit log</h2>
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-600">
            <tr>
              <th className="px-4 py-2 text-left font-medium">Kdy</th>
              <th className="px-4 py-2 text-left font-medium">Kdo</th>
              <th className="px-4 py-2 text-left font-medium">Co</th>
              <th className="px-4 py-2 text-left font-medium">Akce</th>
              <th className="px-4 py-2 text-left font-medium">Entita</th>
            </tr>
          </thead>
          <tbody>
            {logs.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                  Zatím žádné záznamy.
                </td>
              </tr>
            ) : (
              logs.map((log) => (
                <tr key={log.id} className="border-t border-gray-100">
                  <td className="px-4 py-2 text-gray-500">{fmt(log.created_at)}</td>
                  <td className="px-4 py-2">
                    {log.user ? (
                      <div className="flex items-center gap-2">
                        <UserAvatar user={log.user} size="xs" />
                        <span>{crmUserDisplayName(log.user)}</span>
                      </div>
                    ) : (
                      <span className="text-gray-500">(systém)</span>
                    )}
                  </td>
                  <td className="px-4 py-2">{log.entity_type}</td>
                  <td className="px-4 py-2">
                    <span
                      className={cn(
                        "inline-flex rounded-full px-2 py-0.5 text-xs font-medium",
                        ACTION_COLOR[log.action] ?? "bg-gray-100 text-gray-700"
                      )}
                    >
                      {log.action}
                    </span>
                  </td>
                  <td className="px-4 py-2 font-mono text-xs text-gray-500">{log.entity_id}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
