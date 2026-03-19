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

  const row = await prisma.users.findUnique({
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
      department_id: true,
      department_name: true,
      is_active: true,
      display_in_list: true,
      role_id: true,
      user_roles: {
        take: 1,
        select: { role_id: true, module_access: true },
      },
      user_secondary_departments: {
        select: { department_id: true },
        orderBy: { id: "asc" },
      },
    },
  });

  if (!row) notFound();

  const ur = row.user_roles?.[0];
  let module_access: Record<string, string> = {};
  if (ur?.module_access) {
    try {
      const decoded = JSON.parse(ur.module_access);
      if (decoded && typeof decoded === "object" && !Array.isArray(decoded)) {
        if (decoded.all === true) {
          module_access = {
            contacts: "admin",
            equipment: "admin",
            calendar: "admin",
            planovani: "admin",
            vyroba: "admin",
            kiosk: "admin",
            training: "admin",
            iml: "admin",
          };
        } else {
          module_access = decoded as Record<string, string>;
        }
      }
    } catch {
      // ignore
    }
  }

  // Legacy: pokud má department_name ale ne department_id, zkusíme najít oddělení podle názvu
  let department_id = row.department_id;
  if (!department_id && row.department_name) {
    const dept = await prisma.departments.findFirst({
      where: { name: row.department_name },
      select: { id: true },
    });
    if (dept) department_id = dept.id;
  }

  const secondary_department_ids = (
    (row.user_secondary_departments ?? []) as Array<{ department_id: number }>
  ).map((sd) => sd.department_id);

  const { user_roles: _ur, user_secondary_departments: _usd, ...rest } = row;
  const user = {
    ...rest,
    department_id,
    secondary_department_ids,
    role_id: ur?.role_id ?? row.role_id,
    module_access,
  };

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

      <AdminUserForm user={user as Parameters<typeof AdminUserForm>[0]["user"]} />
    </>
  );
}
