import { requireCrmRead, requireCrmWrite, requireCrmAdmin } from "@/lib/crm/guards";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { canEditCompany } from "@/lib/crm/rbac";
import { AppError } from "@/lib/crm/errors";
import { CompanyForm } from "@/components/crm/forms/CompanyForm";

export default async function EditCompanyPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireCrmRead();
  const { id } = await params;
  const company = await prisma.crm_companies.findUnique({ where: { id } });
  if (!company) notFound();
  if (!canEditCompany(user, company)) throw new AppError("FORBIDDEN", "Nemůžeš editovat tuto firmu.");

  const owners = await prisma.users.findMany({ orderBy: [{ last_name: "asc" }, { first_name: "asc" }] });

  return (
    <div className="p-6">
      <h1 className="mb-6 text-2xl font-semibold">Upravit firmu</h1>
      <CompanyForm
        id={company.id}
        owners={owners}
        initial={{
          name: company.name,
          ico: company.ico ?? "",
          dic: company.dic ?? "",
          address: company.address ?? "",
          segment: company.segment ?? "",
          owner_id: company.owner_id,
        }}
      />
    </div>
  );
}
