import { requireCrmRead, requireCrmWrite, requireCrmAdmin } from "@/lib/crm/guards";
import { prisma } from "@/lib/db";
import { DealForm } from "@/components/crm/forms/DealForm";
import { serializeCrmUsers } from "@/lib/crm/users";

export default async function NewDealPage({ searchParams }: { searchParams: Promise<{ company_id?: string }> }) {
  await requireCrmWrite();
  const { company_id } = await searchParams;
  const [owners, lost_reasons, categories] = await Promise.all([
    prisma.users.findMany({
      select: { id: true, first_name: true, last_name: true, email: true },
      orderBy: [{ last_name: "asc" }, { first_name: "asc" }],
    }),
    prisma.crm_lost_reasons.findMany({ where: { active: true }, orderBy: { label: "asc" } }),
    prisma.crm_deal_categories.findMany({
      where: { active: true },
      orderBy: [{ sort_order: "asc" }, { label: "asc" }],
      select: { id: true, code: true, label: true, color: true },
    }),
  ]);
  return (
    <div className="p-6">
      <h1 className="mb-6 text-2xl font-semibold">Nový deal</h1>
      <DealForm owners={serializeCrmUsers(owners)} lost_reasons={lost_reasons} categories={categories} initial={{ company_id }} />
    </div>
  );
}
