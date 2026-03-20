import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { isAdmin } from "@/lib/auth-utils";
import { ArrowLeft, Mail } from "lucide-react";
import { EmailSettingsForm } from "./EmailSettingsForm";

export default async function AdminEmailSettingsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const userId = parseInt(session.user.id, 10);
  if (!(await isAdmin(userId))) {
    redirect("/admin?error=Nemáte oprávnění");
  }

  return (
    <>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900">
            <Mail className="h-7 w-7 text-red-600" />
            Nastavení e-mailu
          </h1>
          <p className="mt-1 text-gray-600">
            Konfigurace SMTP pro odesílání notifikací (Office 365, …)
          </p>
        </div>
        <Link
          href="/admin"
          className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50"
        >
          <ArrowLeft className="h-4 w-4" />
          Zpět
        </Link>
      </div>

      <EmailSettingsForm />
    </>
  );
}
