import { requireCrmRead, requireCrmWrite, requireCrmAdmin } from "@/lib/crm/guards";
import { prisma } from "@/lib/db";
import { KanbanBoard } from "@/components/crm/KanbanBoard";
import { DealFilterBar } from "@/components/crm/deals/DealFilterBar";
import { ActiveFilterPills } from "@/components/crm/deals/ActiveFilterPills";
import { DealsEmptyState } from "@/components/crm/deals/DealsEmptyState";
import { parseFilters, buildWhere } from "@/lib/crm/deal-filters";
import { crmUserDisplayName, serializeCrmUsers } from "@/lib/crm/users";

export default async function KanbanPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requireCrmRead();
  const raw = await searchParams;
  const filters = parseFilters(raw, session.role);
  const filterWhere = buildWhere(filters, session.id);

  const [deals, categories, lost_reasons, users] = await Promise.all([
    prisma.crm_deals.findMany({
      where: {
        AND: [
          { stage: { notIn: ["WON", "LOST", "CANCELLED"] } },
          filterWhere,
        ],
      },
      include: { company: { select: { name: true } },
        owner: { select: { id: true, first_name: true, last_name: true, email: true } },
        category: { select: { label: true, color: true } },
      },
      orderBy: { updated_at: "desc" },
      take: 500,
    }),
    prisma.crm_deal_categories.findMany({
      where: { active: true },
      orderBy: [{ sort_order: "asc" }, { label: "asc" }],
      select: { id: true, code: true, label: true, color: true },
    }),
    prisma.crm_lost_reasons.findMany({
      where: { active: true },
      orderBy: { label: "asc" },
      select: { code: true, label: true },
    }),
    prisma.users.findMany({
      where: session.role === "ADMIN" ? {} : { is_active: true },
      orderBy: [{ last_name: "asc" }, { first_name: "asc" }],
      select: { id: true, first_name: true, last_name: true, email: true },
    }),
  ]);

  const usersForUi = serializeCrmUsers(users);
  const mapped = deals.map((d) => ({
    id: d.id,
    number: d.number,
    title: d.title,
    value: Number(d.value),
    probability: d.probability,
    stage: d.stage,
    company: { name: d.company.name },
    owner: {
      id: d.owner.id,
      name: crmUserDisplayName(d.owner),
      email: d.owner.email,
      image: null,
    },
    category: d.category ? { label: d.category.label, color: d.category.color } : null,
  }));

  const canCreate = session.role === "ADMIN" || session.role === "SALES";
  const isFiltered =
    filters.q !== "" ||
    filters.mine !== (session.role === "SALES") ||
    filters.owner_ids.length > 0 ||
    filters.category_ids.length > 0 ||
    filters.closeFrom !== null ||
    filters.closeTo !== null;

  return (
    <div className="space-y-4 p-6">
      <h1 className="text-2xl font-semibold">Pipeline</h1>
      <DealFilterBar
        filters={filters}
        users={usersForUi}
        categories={categories}
        view="kanban"
      />
      <ActiveFilterPills
        filters={filters}
        users={usersForUi}
        categories={categories}
        sessionRole={session.role}
      />
      {mapped.length === 0 && isFiltered ? (
        <DealsEmptyState role={session.role} />
      ) : (
        <KanbanBoard
          initialDeals={mapped}
          categories={categories}
          lost_reasons={lost_reasons}
          canCreate={canCreate}
        />
      )}
    </div>
  );
}
