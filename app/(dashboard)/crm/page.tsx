import { prisma } from "@/lib/db";
import { requireCrmRead } from "@/lib/crm/guards";
import { Building2, Briefcase, Users, Clock } from "lucide-react";
import { PipelineWidget } from "@/components/crm/dashboard/PipelineWidget";
import { ForecastWidget } from "@/components/crm/dashboard/ForecastWidget";
import { ActivitiesPerRepWidget } from "@/components/crm/dashboard/ActivitiesPerRepWidget";
import { RemindersWidget } from "@/components/crm/reminders/RemindersWidget";
import { RecentActivityWidget } from "@/components/crm/dashboard/RecentActivityWidget";
import { StaleDealsWidget } from "@/components/crm/dashboard/StaleDealsWidget";

export default async function CrmDashboardPage() {
  const user = await requireCrmRead();
  const isSales = user.role === "SALES";
  const isAdmin = user.role === "ADMIN";
  const scopedOwnerId = isSales ? user.id : undefined;

  const [companiesCount, contactsCount, dealsCount, openDealsCount, activitiesCount] =
    await Promise.all([
      prisma.crm_companies.count(),
      prisma.crm_contacts.count(),
      prisma.crm_deals.count(),
      prisma.crm_deals.count({
        where: { stage: { notIn: ["WON", "LOST", "CANCELLED"] } },
      }),
      prisma.crm_activities.count(),
    ]);

  const stats = [
    { label: "Firmy", value: companiesCount, icon: Building2 },
    { label: "Kontakty", value: contactsCount, icon: Users },
    { label: "Obchody", value: dealsCount, icon: Briefcase },
    { label: "Otevřené obchody", value: openDealsCount, icon: Briefcase },
    { label: "Aktivity", value: activitiesCount, icon: Clock },
  ];

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {stats.map((s) => {
          const Icon = s.icon;
          return (
            <div
              key={s.label}
              className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm"
            >
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Icon className="h-4 w-4" />
                {s.label}
              </div>
              <p className="mt-2 text-2xl font-bold text-gray-900">{s.value}</p>
            </div>
          );
        })}
      </div>

      <PipelineWidget owner_id={scopedOwnerId} />
      <ForecastWidget owner_id={scopedOwnerId} />
      <RemindersWidget userId={user.id} />

      <div className="grid gap-6 md:grid-cols-2">
        <StaleDealsWidget userId={user.id} role={user.role} />
        <RecentActivityWidget userId={user.id} role={user.role} />
      </div>

      {isAdmin ? <ActivitiesPerRepWidget /> : null}
    </div>
  );
}
