import { prisma } from "@/lib/db";
import Link from "next/link";
import type { CrmRole } from "@/lib/crm/permissions";
import { STAGE_LABELS } from "@/lib/crm/deal-stages";
import { Clock } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";

const STALE_THRESHOLD_DAYS = 14;

export async function StaleDealsWidget({
  userId,
  role,
}: {
  userId: number;
  role: CrmRole;
}) {
  const cutoff = new Date(Date.now() - STALE_THRESHOLD_DAYS * 24 * 60 * 60 * 1000);
  const where = role === "SALES" ? { owner_id: userId } : {};

  const deals = await prisma.crm_deals.findMany({
    where: {
      ...where,
      stage: { notIn: ["WON", "LOST", "CANCELLED"] },
      updated_at: { lt: cutoff },
    },
    include: { company: { select: { name: true } } },
    orderBy: { updated_at: "asc" },
    take: 10,
  });

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <h3 className="mb-4 text-[13px] font-semibold tracking-tight text-gray-900">
        Bez aktivity &gt; {STALE_THRESHOLD_DAYS} dní
      </h3>
      {deals.length === 0 ? (
        <EmptyState
          icon={Clock}
          title="Vše aktivní"
          description="Žádný deal nestagnuje déle než 14 dní."
        />
      ) : (
        <ul className="space-y-2 text-sm">
          {deals.map((d) => (
            <li key={d.id}>
              <Link href={`/crm/deals/${d.id}`} className="hover:underline">
                <strong>{d.title}</strong>
              </Link>{" "}
              <span className="text-gray-500">
                · {d.company.name} · {STAGE_LABELS[d.stage]}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
