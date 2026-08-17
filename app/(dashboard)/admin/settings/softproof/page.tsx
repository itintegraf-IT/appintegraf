import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { redirectWithError } from "@/lib/navigation-errors";
import Link from "next/link";
import { isAdmin } from "@/lib/auth-utils";
import { ArrowLeft, Languages } from "lucide-react";
import { SoftproofTemplatesForm } from "@/app/(dashboard)/makety/nastaveni/softproof/SoftproofTemplatesForm";

export default async function AdminSoftproofTemplatesPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const userId = parseInt(session.user.id, 10);
  if (!(await isAdmin(userId))) {
    redirectWithError("/admin", "NO_PERMISSION");
  }

  return (
    <>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900">
            <Languages className="h-7 w-7 text-red-600" />
            Šablony softproofu
          </h1>
          <p className="mt-1 text-gray-600">
            Texty e-mailu a veřejné stránky náhledu v jednotlivých jazycích (CZ, EN, DE, …)
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

      <SoftproofTemplatesForm />
    </>
  );
}
