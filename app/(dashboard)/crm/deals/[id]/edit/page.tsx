import { requireCrmRead, requireCrmWrite, requireCrmAdmin } from "@/lib/crm/guards";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { canEditDeal } from "@/lib/crm/rbac";
import { AppError } from "@/lib/crm/errors";
import { DealForm } from "@/components/crm/forms/DealForm";
import { serializeCrmUsers } from "@/lib/crm/users";

export default async function EditDealPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireCrmRead();
  const { id } = await params;
  const deal = await prisma.crm_deals.findUnique({
    where: { id },
    include: { deal_contacts: true },
  });
  if (!deal) notFound();
  if (!canEditDeal(user, deal)) throw new AppError("FORBIDDEN", "Nemůžeš editovat tento deal.");
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
      <h1 className="mb-6 text-2xl font-semibold">Upravit deal</h1>
      <DealForm
        id={deal.id}
        owners={serializeCrmUsers(owners)}
        lost_reasons={lost_reasons}
        categories={categories}
        initial={{
          company_id: deal.company_id,
          owner_id: deal.owner_id ?? undefined,
          title: deal.title,
          value: Number(deal.value),
          stage: deal.stage,
          probability: deal.probability,
          close_date: deal.close_date ? deal.close_date.toISOString().slice(0, 10) : "",
          lost_reason: deal.lost_reason ?? "",
          contactIds: deal.deal_contacts.map((dc) => dc.contact_id),
          category_id: deal.category_id ?? null,
        }}
      />
    </div>
  );
}
