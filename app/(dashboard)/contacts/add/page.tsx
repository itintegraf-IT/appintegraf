import { auth } from "@/auth";
import { hasModuleAccess } from "@/lib/auth-utils";
import { redirect } from "next/navigation";
import { ContactForm } from "../ContactForm";

export default async function AddContactPage() {
  const session = await auth();
  const userId = session?.user?.id ? parseInt(session.user.id, 10) : 0;

  if (!(await hasModuleAccess(userId, "contacts", "write"))) {
    redirect("/contacts?error=Nemáte oprávnění");
  }

  return (
    <>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Přidat kontakt</h1>
        <p className="mt-1 text-gray-600">Nový kontakt v systému</p>
      </div>
      <ContactForm />
    </>
  );
}
