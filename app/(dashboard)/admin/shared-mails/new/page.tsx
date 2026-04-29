import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/auth-utils";
import { SharedMailForm } from "../SharedMailForm";
import Link from "next/link";
import { ArrowLeft, Mail } from "lucide-react";

export default async function NewSharedMailPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const userId = parseInt(session.user.id, 10);
  if (!(await isAdmin(userId))) redirect("/contacts?error=Nemáte oprávnění");

  return (
    <>
      <div className="mb-6">
        <Link
          href="/admin/shared-mails"
          className="mb-2 inline-flex items-center gap-2 text-sm text-gray-600 hover:text-red-600"
        >
          <ArrowLeft className="h-4 w-4" />
          Zpět na seznam
        </Link>
        <h1 className="mt-2 flex items-center gap-2 text-2xl font-bold text-gray-900">
          <Mail className="h-7 w-7 text-red-600" />
          Nový společný e-mail
        </h1>
      </div>
      <SharedMailForm
        initial={{ email: "", label: "", sort_order: 0, is_active: true }}
      />
    </>
  );
}
