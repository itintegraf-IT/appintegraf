import { prisma } from "@/lib/db";
import { DealCategoriesEditor } from "./DealCategoriesEditor";

export const dynamic = "force-dynamic";

export default async function DealCategoriesPage() {
  const categories = await prisma.crm_deal_categories.findMany({
    orderBy: [{ active: "desc" }, { sort_order: "asc" }, { label: "asc" }],
  });
  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-xl font-semibold text-gray-900">Kategorie dealů</h2>
      <DealCategoriesEditor initialCategories={categories} />
    </div>
  );
}
