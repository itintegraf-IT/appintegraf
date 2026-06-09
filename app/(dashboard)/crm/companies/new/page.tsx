import { requireCrmRead, requireCrmWrite, requireCrmAdmin } from "@/lib/crm/guards";
import { prisma } from "@/lib/db";
import { CompanyForm } from "@/components/crm/forms/CompanyForm";

export default async function NewCompanyPage() {
  await requireCrmWrite();
  const owners = await prisma.users.findMany({ orderBy: [{ last_name: "asc" }, { first_name: "asc" }] });

  return (
    <div className="p-6">
      <h1 className="mb-6 text-2xl font-semibold">Nová firma</h1>
      <CompanyForm owners={owners} />
    </div>
  );
}
