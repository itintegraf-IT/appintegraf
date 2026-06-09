import { requireCrmRead, requireCrmWrite, requireCrmAdmin } from "@/lib/crm/guards";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { CompaniesTable } from "@/components/crm/CompaniesTable";
import { CompanyListQuerySchema } from "@/lib/crm/validators/company";
import type { Prisma } from "@prisma/client";

const PAGE_SIZE = 50;

export default async function CompaniesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireCrmRead();
  const raw = await searchParams;
  const parsed = CompanyListQuerySchema.safeParse(raw);
  const { q, owner_id, segment, page, sortBy, sortDir } = parsed.success
    ? parsed.data
    : { q: undefined, owner_id: undefined, segment: undefined, page: 1, sortBy: undefined, sortDir: undefined };

  const where: Prisma.crm_companiesWhereInput = {
    ...(q ? { OR: [{ name: { contains: q } }, { ico: { contains: q } }] } : {}),
    ...(owner_id ? { owner_id } : {}),
    ...(segment ? { segment } : {}),
  };

  const orderBy: Prisma.crm_companiesOrderByWithRelationInput = sortBy
    ? { [sortBy]: sortDir ?? "asc" }
    : { updated_at: "desc" };

  const [items, total, owners] = await Promise.all([
    prisma.crm_companies.findMany({
      where,
      include: {
        owner: { select: { id: true, first_name: true, last_name: true, email: true } },
        _count: { select: { contacts: true, deals: true } },
      },
      orderBy,
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.crm_companies.count({ where }),
    prisma.users.findMany({ orderBy: [{ last_name: "asc" }, { first_name: "asc" }] }),
  ]);

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Firmy</h1>
          <p className="text-sm text-foreground/70">{total} záznamů</p>
        </div>
        <Button asChild>
          <Link href="/crm/companies/new">Nová firma</Link>
        </Button>
      </div>
      <CompaniesTable
        items={items}
        owners={owners}
        params={{ q, owner_id, segment }}
        total={total}
        page={page}
        pageSize={PAGE_SIZE}
        sortBy={sortBy}
        sortDir={sortDir}
      />
    </div>
  );
}
