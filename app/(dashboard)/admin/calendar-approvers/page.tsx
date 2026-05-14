import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/auth-utils";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { Calendar, ArrowLeft } from "lucide-react";
import { CalendarApproversClient } from "./CalendarApproversClient";

export default async function AdminCalendarApproversPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const userId = parseInt(session.user.id, 10);
  if (!(await isAdmin(userId))) {
    redirect("/contacts?error=Nemáte oprávnění");
  }

  const departments = await prisma.departments.findMany({
    where: { is_active: true },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      code: true,
      manager_id: true,
      users: { select: { id: true, first_name: true, last_name: true } },
      calendar_department_approvers: {
        select: {
          id: true,
          primary_user_id: true,
          secondary_user_id: true,
          tertiary_user_id: true,
          users_primary: { select: { id: true, first_name: true, last_name: true } },
          users_secondary: { select: { id: true, first_name: true, last_name: true } },
          users_tertiary: { select: { id: true, first_name: true, last_name: true } },
        },
      },
    },
  });

  return (
    <>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900">
            <Calendar className="h-7 w-7 text-red-600" />
            Schvalovatelé kalendáře
          </h1>
          <p className="mt-1 text-gray-600">Primární, sekundární a terciární schvalovatelé podle oddělení</p>
        </div>
        <Link
          href="/admin"
          className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-gray-700 shadow-sm hover:bg-gray-50"
        >
          <ArrowLeft className="h-4 w-4" />
          Administrace
        </Link>
      </div>

      <CalendarApproversClient departments={departments} />
    </>
  );
}
