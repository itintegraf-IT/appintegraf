import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { hasModuleAccess } from "@/lib/auth-utils";
import { NewUkolForm } from "./NewUkolForm";

export const dynamic = "force-dynamic";

export default async function NewUkolPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const userId = parseInt(session.user.id, 10);
  if (!(await hasModuleAccess(userId, "ukoly", "write"))) {
    redirect("/ukoly");
  }

  const departments = await prisma.departments.findMany({
    where: { is_active: true, display_in_list: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  const users = await prisma.users.findMany({
    where: { is_active: true },
    orderBy: [{ last_name: "asc" }, { first_name: "asc" }],
    select: {
      id: true,
      first_name: true,
      last_name: true,
      department_id: true,
      user_secondary_departments: { select: { department_id: true } },
    },
    take: 500,
  });

  return (
    <div>
      <h2 className="mb-4 text-xl font-semibold text-gray-900">Nový úkol</h2>
      <p className="mb-6 text-sm text-gray-600">Vyplňte zadání, termín a přiřazení úkolu.</p>
      <NewUkolForm departments={departments} users={users} />
    </div>
  );
}
