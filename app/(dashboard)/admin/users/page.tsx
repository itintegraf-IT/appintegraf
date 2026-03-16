import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/auth-utils";
import Link from "next/link";
import { Users, Plus, ArrowLeft } from "lucide-react";
import { AdminUsersClient } from "./AdminUsersClient";

export default async function AdminUsersPage() {
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
          <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900">
            <Users className="h-7 w-7 text-red-600" />
            Správa uživatelů
          </h1>
          <p className="mt-1 text-gray-600">Přehled a úprava uživatelů systému</p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/admin"
            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50"
          >
            <ArrowLeft className="h-4 w-4" />
            Zpět
          </Link>
          <Link
            href="/admin/users/add"
            className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 font-medium text-white hover:bg-red-700"
          >
            <Plus className="h-4 w-4" />
            Přidat uživatele
          </Link>
        </div>
      </div>

      <AdminUsersClient />
    </>
  );
}
