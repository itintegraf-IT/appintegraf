import { requireCrmRead, requireCrmWrite, requireCrmAdmin } from "@/lib/crm/guards";
import { prisma } from "@/lib/db";
import { REMINDER_TYPES } from "@/lib/crm/reminder";
import { RemindersPageTabs } from "@/components/crm/reminders/RemindersPageTabs";
import type { ReminderRow } from "@/components/crm/reminders/RemindersWidgetClient";

export const metadata = {
  title: "Připomenutí",
};

async function buildRows(
  rows: Awaited<ReturnType<typeof prisma.crm_activities.findMany>>,
): Promise<ReminderRow[]> {
  const company_ids = rows.filter((r) => r.parent_type === "COMPANY").map((r) => r.parent_id);
  const contactIds = rows.filter((r) => r.parent_type === "CONTACT").map((r) => r.parent_id);
  const dealIds = rows.filter((r) => r.parent_type === "DEAL").map((r) => r.parent_id);

  const [companies, contacts, deals] = await Promise.all([
    company_ids.length
      ? prisma.crm_companies.findMany({ where: { id: { in: company_ids } }, select: { id: true, name: true } })
      : Promise.resolve([] as { id: string; name: string }[]),
    contactIds.length
      ? prisma.crm_contacts.findMany({
          where: { id: { in: contactIds } },
          select: { id: true, first_name: true, last_name: true },
        })
      : Promise.resolve([] as { id: string; first_name: string; last_name: string }[]),
    dealIds.length
      ? prisma.crm_deals.findMany({ where: { id: { in: dealIds } }, select: { id: true, title: true } })
      : Promise.resolve([] as { id: string; title: string }[]),
  ]);

  const companyById = new Map(companies.map((c) => [c.id, c]));
  const contactById = new Map(contacts.map((c) => [c.id, c]));
  const dealById = new Map(deals.map((d) => [d.id, d]));

  return rows.map((r) => {
    let parent: ReminderRow["parent"];
    if (r.parent_type === "DEAL") {
      const d = dealById.get(r.parent_id);
      parent = { type: "DEAL", id: r.parent_id, name: d?.title ?? "(smazáno)" };
    } else if (r.parent_type === "COMPANY") {
      const c = companyById.get(r.parent_id);
      parent = { type: "COMPANY", id: r.parent_id, name: c?.name ?? "(smazáno)" };
    } else {
      const c = contactById.get(r.parent_id);
      parent = {
        type: "CONTACT",
        id: r.parent_id,
        name: c ? `${c.first_name} ${c.last_name}`.trim() : "(smazáno)",
      };
    }
    return {
      id: r.id,
      type: r.type as ReminderRow["type"],
      date: r.date.toISOString(),
      note: r.note,
      completed_at: r.completed_at ? r.completed_at.toISOString() : null,
      parent,
    };
  });
}

export default async function RemindersPage() {
  const user = await requireCrmRead();
  const types = REMINDER_TYPES as unknown as ReminderRow["type"][];

  const [upcomingRows, completedRows] = await Promise.all([
    prisma.crm_activities.findMany({
      where: {
        owner_id: user.id,
        type: { in: types },
        completed_at: null,
      },
      orderBy: { date: "asc" },
      take: 200,
    }),
    prisma.crm_activities.findMany({
      where: {
        owner_id: user.id,
        type: { in: types },
        completed_at: { not: null },
      },
      orderBy: { completed_at: "desc" },
      take: 100,
    }),
  ]);

  const [upcoming, completed] = await Promise.all([
    buildRows(upcomingRows),
    buildRows(completedRows),
  ]);

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold">Připomenutí</h1>
        <p className="text-sm text-muted-foreground">
          Tvoje hovory, schůzky a připomenutí — nadcházející a splněné.
        </p>
      </div>
      <RemindersPageTabs upcoming={upcoming} completed={completed} />
    </div>
  );
}
