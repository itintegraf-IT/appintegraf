import { requireCrmRead, requireCrmWrite, requireCrmAdmin } from "@/lib/crm/guards";
import Link from "next/link";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { DealsTable } from "@/components/crm/DealsTable";
import { DealsListQuickAdd } from "@/components/crm/deals/DealsListQuickAdd";
import { DealFilterBar } from "@/components/crm/deals/DealFilterBar";
import { ActiveFilterPills } from "@/components/crm/deals/ActiveFilterPills";
import { DealsEmptyState } from "@/components/crm/deals/DealsEmptyState";
import { parseFilters, buildWhere } from "@/lib/crm/deal-filters";
import { serializeCrmUsers } from "@/lib/crm/users";

const PAGE_SIZE = 50;

const PaginationSortSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  sortBy: z.enum(["title", "stage", "value", "probability", "updated_at"]).optional(),
  sortDir: z.enum(["asc", "desc"]).optional(),
});

export default async function DealsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requireCrmRead();
  const raw = await searchParams;
  const filters = parseFilters(raw, session.role);
  const filterWhere = buildWhere(filters, session.id);
  const ps = PaginationSortSchema.safeParse(raw);
  const { page, sortBy, sortDir } = ps.success ? ps.data : { page: 1, sortBy: undefined, sortDir: undefined };

  const where: Prisma.crm_dealsWhereInput = filterWhere;
  const orderBy: Prisma.crm_dealsOrderByWithRelationInput = sortBy
    ? { [sortBy]: sortDir ?? "asc" }
    : { updated_at: "desc" };

  const [items, total, categories, lost_reasons, users] = await Promise.all([
    prisma.crm_deals.findMany({
      where,
      include: { company: { select: { id: true, name: true } },
        owner: { select: { id: true, first_name: true, last_name: true, email: true } },
      },
      orderBy,
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.crm_deals.count({ where }),
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

  const canCreate = session.role === "ADMIN" || session.role === "SALES";
  const isFiltered =
    filters.q !== "" ||
    filters.mine !== (session.role === "SALES") ||
    filters.owner_ids.length > 0 ||
    filters.category_ids.length > 0 ||
    filters.stages.length > 0 ||
    filters.closeFrom !== null ||
    filters.closeTo !== null;

  const usersForUi = serializeCrmUsers(users);
  const dealsForTable = items.map((d) => ({
    id: d.id,
    number: d.number,
    title: d.title,
    stage: d.stage,
    value: Number(d.value),
    probability: d.probability,
    company: d.company,
    owner: usersForUi.find((u) => u.id === d.owner.id) ?? {
      id: d.owner.id,
      name: [d.owner.first_name, d.owner.last_name].filter(Boolean).join(" ").trim() || d.owner.email,
      email: d.owner.email,
      image: null,
    },
  }));

  return (
    <div className="space-y-4 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Dealy</h1>
          <p className="text-sm text-foreground/70">{total} záznamů</p>
        </div>
        <div className="flex items-center gap-3">
          <Button asChild variant="outline">
            <Link href="/crm/deals/kanban">Kanban</Link>
          </Button>
          {canCreate ? (
            <DealsListQuickAdd categories={categories} lost_reasons={lost_reasons} />
          ) : null}
        </div>
      </div>
      <DealFilterBar
        filters={filters}
        users={usersForUi}
        categories={categories}
        view="listing"
      />
      <ActiveFilterPills
        filters={filters}
        users={usersForUi}
        categories={categories}
        sessionRole={session.role}
      />
      {dealsForTable.length === 0 && isFiltered ? (
        <DealsEmptyState role={session.role} />
      ) : (
        <DealsTable
          items={dealsForTable}
          total={total}
          page={page}
          pageSize={PAGE_SIZE}
          sortBy={sortBy}
          sortDir={sortDir}
        />
      )}
    </div>
  );
}
