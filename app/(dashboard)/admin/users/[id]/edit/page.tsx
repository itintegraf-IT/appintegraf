import { auth } from "@/auth";
import { redirect, notFound } from "next/navigation";
import { redirectAdminDenied } from "@/lib/navigation-errors";
import { isAdmin } from "@/lib/auth-utils";
import { prisma } from "@/lib/db";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { AdminUserForm } from "../../AdminUserForm";
import { parseStoredModuleAccess } from "@/lib/app-modules";
import { userHasVehicleManagerRole } from "@/lib/sync-vehicle-manager-role";
import { VEHICLE_MANAGER_ROLE } from "@/lib/resource-reservation-types";

export default async function AdminUserEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const userId = parseInt(session.user.id, 10);
  if (!(await isAdmin(userId))) {
    redirectAdminDenied();
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
        select: { role_id: true, module_access: true, roles: { select: { name: true } } },
      },
      user_secondary_departments: {
        select: { department_id: true },
        orderBy: { id: "asc" },
      },
      user_shared_mails: { select: { shared_mail_id: true } },
    },
  });

  if (!row) notFound();

  const ur =
    row.user_roles?.find((r) => r.roles.name?.toLowerCase() !== VEHICLE_MANAGER_ROLE) ??
    row.user_roles?.[0];
  const module_access = ur?.module_access
    ? parseStoredModuleAccess(ur.module_access)
    : {};

  const vehicle_manager = await userHasVehicleManagerRole(id);

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

  const shared_mail_ids = (row.user_shared_mails ?? []).map((m) => m.shared_mail_id);

  const { user_roles: _ur, user_secondary_departments: _usd, user_shared_mails: _usm, ...rest } = row;
  const user = {
    ...rest,
    department_id,
    secondary_department_ids,
    shared_mail_ids,
    role_id: ur?.role_id ?? row.role_id,
    module_access,
    vehicle_manager,
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
