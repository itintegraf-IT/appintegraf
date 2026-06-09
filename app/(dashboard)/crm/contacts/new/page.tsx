import { requireCrmRead, requireCrmWrite, requireCrmAdmin } from "@/lib/crm/guards";
import { ContactForm } from "@/components/crm/forms/ContactForm";

export default async function NewContactPage({
  searchParams,
}: {
  searchParams: Promise<{ company_id?: string }>;
}) {
  await requireCrmWrite();
  const { company_id } = await searchParams;
  return (
    <div className="p-6">
      <h1 className="mb-6 text-2xl font-semibold">Nový kontakt</h1>
      <ContactForm initial={{ company_id }} />
    </div>
  );
}
