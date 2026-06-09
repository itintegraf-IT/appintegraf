import { prisma } from "@/lib/db";
import { format } from "date-fns";
import { cs } from "date-fns/locale";
import type { CrmRole } from "@/lib/crm/permissions";
import { Activity as ActivityIcon } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { crmUserDisplayName } from "@/lib/crm/users";

const TYPE_LABEL_MAP: Record<string, string> = {
  CALL: "Hovor",
  MEETING: "Schůzka",
  EMAIL: "Email",
  REMINDER: "Připomenutí",
  NOTE: "Poznámka",
};

export async function RecentActivityWidget({
  userId,
  role,
}: {
  userId: number;
  role: CrmRole;
}) {
  const where =
    role === "SALES"
      ? { OR: [{ owner_id: userId }, { assignee_id: userId }] }
      : {};

  const activities = await prisma.crm_activities.findMany({
    where,
    include: {
      owner: { select: { id: true, first_name: true, last_name: true, email: true } },
    },
    orderBy: { date: "desc" },
    take: 10,
  });

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <h3 className="mb-4 text-[13px] font-semibold tracking-tight text-gray-900">
        Poslední aktivity
      </h3>
      {activities.length === 0 ? (
        <EmptyState
          icon={ActivityIcon}
          title="Žádné aktivity"
          description="Zalogované hovory a maily se objeví tady."
        />
      ) : (
        <ul className="space-y-2 text-sm">
          {activities.map((a) => (
            <li key={a.id} className="flex items-baseline justify-between gap-2">
              <div className="min-w-0 flex-1 truncate">
                <strong>{TYPE_LABEL_MAP[a.type] ?? a.type}</strong> · {a.note ?? "(bez poznámky)"}{" "}
                ·{" "}
                <span className="text-gray-500">
                  {a.owner ? crmUserDisplayName(a.owner) : "—"}
                </span>
              </div>
              <time className="shrink-0 text-gray-500">
                {format(a.date, "d. M.", { locale: cs })}
              </time>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
