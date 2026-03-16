import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { hasModuleAccess } from "@/lib/auth-utils";
import { prisma } from "@/lib/db";
import { ContactForm } from "../../ContactForm";

export default async function EditContactPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  const userId = session?.user?.id ? parseInt(session.user.id, 10) : 0;

  if (!(await hasModuleAccess(userId, "contacts", "write"))) {
    notFound();
  }

  const id = parseInt((await params).id, 10);
  if (isNaN(id)) notFound();

  const contact = await prisma.users.findFirst({
    where: { id, is_active: true },
    select: {
      id: true,
      username: true,
      email: true,
      first_name: true,
      last_name: true,
      phone: true,
      landline: true,
      landline2: true,
      position: true,
      department_name: true,
      role_id: true,
      display_in_list: true,
    },
  });

  if (!contact) notFound();

  return (
    <>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Upravit kontakt</h1>
        <p className="mt-1 text-gray-600">{contact.first_name} {contact.last_name}</p>
      </div>
      <ContactForm contact={contact} />
    </>
  );
}
