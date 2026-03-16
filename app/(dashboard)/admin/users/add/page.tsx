import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/auth-utils";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { AdminUserForm } from "../AdminUserForm";

export default async function AdminUserAddPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const userId = parseInt(session.user.id, 10);
  if (!(await isAdmin(userId))) {
    redirect("/contacts?error=Nemáte oprávnění");
  }

  return (
    <>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Přidat uživatele</h1>
          <p className="mt-1 text-gray-600">Nový uživatel v systému</p>
        </div>
        <Link
          href="/admin/users"
          className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50"
        >
          <ArrowLeft className="h-4 w-4" />
          Zpět
        </Link>
      </div>

      <AdminUserForm />
    </>
  );
}
