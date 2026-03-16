import { auth } from "@/auth";
import { redirect, notFound } from "next/navigation";
import { isAdmin } from "@/lib/auth-utils";
import { prisma } from "@/lib/db";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { AdminUserForm } from "../../AdminUserForm";

export default async function AdminUserEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const userId = parseInt(session.user.id, 10);
  if (!(await isAdmin(userId))) {
    redirect("/contacts?error=Nemáte oprávnění");
  }

  const id = parseInt((await params).id, 10);
  if (isNaN(id)) notFound();

  const user = await prisma.users.findUnique({
    where: { id },
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
      is_active: true,
      display_in_list: true,
      role_id: true,
    },
  });

  if (!user) notFound();

  return (
    <>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Upravit uživatele</h1>
          <p className="mt-1 text-gray-600">
            {user.first_name} {user.last_name}
          </p>
        </div>
        <Link
          href="/admin/users"
          className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50"
        >
          <ArrowLeft className="h-4 w-4" />
          Zpět
        </Link>
      </div>

      <AdminUserForm user={user} />
    </>
  );
}
