import { requireCrmRead, requireCrmWrite, requireCrmAdmin } from "@/lib/crm/guards";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { canEditCompany } from "@/lib/crm/rbac";
import { AppError } from "@/lib/crm/errors";
import { ContactForm } from "@/components/crm/forms/ContactForm";

export default async function EditContactPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireCrmRead();
  const { id } = await params;
  const contact = await prisma.crm_contacts.findUnique({
    where: { id },
    include: { company: true },
  });
  if (!contact) notFound();
  if (!canEditCompany(user, contact.company))
    throw new AppError("FORBIDDEN", "Nemůžeš editovat tento kontakt.");
  return (
    <div className="p-6">
      <h1 className="mb-6 text-2xl font-semibold">Upravit kontakt</h1>
      <ContactForm
        id={contact.id}
        initial={{
          first_name: contact.first_name,
          last_name: contact.last_name,
          role: contact.role ?? "",
          email: contact.email ?? "",
          phone: contact.phone ?? "",
          company_id: contact.company_id,
          is_decision_maker: contact.is_decision_maker,
        }}
      />
    </div>
  );
}
