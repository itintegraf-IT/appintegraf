import { auth } from "@/auth";
import { redirect, notFound } from "next/navigation";
import { isAdmin } from "@/lib/auth-utils";
import { prisma } from "@/lib/db";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { DepartmentForm } from "../../DepartmentForm";

export default async function AdminDepartmentEditPage({
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

  const department = await prisma.departments.findUnique({
    where: { id },
  });

  if (!department) notFound();

  return (
    <>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Upravit oddělení</h1>
          <p className="mt-1 text-gray-600">{department.name}</p>
        </div>
        <Link
          href="/admin/departments"
          className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50"
        >
          <ArrowLeft className="h-4 w-4" />
          Zpět
        </Link>
      </div>

      <DepartmentForm department={department} />
    </>
  );
}
