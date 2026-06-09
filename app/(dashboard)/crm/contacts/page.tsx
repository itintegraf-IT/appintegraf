import { requireCrmRead, requireCrmWrite, requireCrmAdmin } from "@/lib/crm/guards";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { ContactsTable } from "@/components/crm/ContactsTable";
import { ContactListQuerySchema } from "@/lib/crm/validators/contact";
import type { Prisma } from "@prisma/client";

const PAGE_SIZE = 50;

export default async function ContactsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireCrmRead();
  const raw = await searchParams;
  const parsed = ContactListQuerySchema.safeParse(raw);
  const { q, company_id, page, sortBy, sortDir } = parsed.success
    ? parsed.data
    : { q: undefined, company_id: undefined, page: 1, sortBy: undefined, sortDir: undefined };

  const where: Prisma.crm_contactsWhereInput = {
    ...(q
      ? {
          OR: [
            { first_name: { contains: q } },
            { last_name: { contains: q } },
            { email: { contains: q } },
          ],
        }
      : {}),
    ...(company_id ? { company_id } : {}),
  };

  const orderBy: Prisma.crm_contactsOrderByWithRelationInput = sortBy
    ? { [sortBy]: sortDir ?? "asc" }
    : { last_name: "asc" };

  const [items, total] = await Promise.all([
    prisma.crm_contacts.findMany({
      where,
      include: { company: { select: { id: true, name: true } } },
      orderBy,
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.crm_contacts.count({ where }),
  ]);

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Kontakty</h1>
          <p className="text-sm text-foreground/70">{total} záznamů</p>
        </div>
        <Button asChild>
          <Link href="/crm/contacts/new">Nový kontakt</Link>
        </Button>
      </div>
      <ContactsTable
        items={items}
        params={{ q }}
        total={total}
        page={page}
        pageSize={PAGE_SIZE}
        sortBy={sortBy}
        sortDir={sortDir}
      />
    </div>
  );
}
