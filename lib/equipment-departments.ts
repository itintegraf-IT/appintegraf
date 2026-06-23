import { prisma } from "@/lib/db";

export async function isInDepartment(userId: number, departmentName: string): Promise<boolean> {
  const dept = await prisma.departments.findFirst({
    where: { name: departmentName, is_active: true },
  });
  if (!dept) return false;
  const inMain = await prisma.users.findFirst({
    where: { id: userId, department_id: dept.id },
  });
  if (inMain) return true;
  const inSecondary = await prisma.user_secondary_departments.findFirst({
    where: { user_id: userId, department_id: dept.id },
  });
  return !!inSecondary;
}

export async function getDepartmentMembers(departmentName: string) {
  const dept = await prisma.departments.findFirst({
    where: { name: departmentName, is_active: true },
    select: { id: true },
  });
  if (!dept) return [];

  const primary = await prisma.users.findMany({
    where: { department_id: dept.id, is_active: true },
    select: { id: true, first_name: true, last_name: true, email: true },
    orderBy: [{ last_name: "asc" }, { first_name: "asc" }],
  });

  const secondary = await prisma.user_secondary_departments.findMany({
    where: { department_id: dept.id },
    select: {
      users: {
        select: { id: true, first_name: true, last_name: true, email: true, is_active: true },
      },
    },
  });

  const seen = new Set<number>();
  const out: { id: number; first_name: string; last_name: string; email: string }[] = [];
  for (const u of primary) {
    if (!seen.has(u.id)) {
      seen.add(u.id);
      out.push({ id: u.id, first_name: u.first_name, last_name: u.last_name, email: u.email ?? "" });
    }
  }
  for (const row of secondary) {
    const u = row.users;
    if (!u || !u.is_active) continue;
    if (!seen.has(u.id)) {
      seen.add(u.id);
      out.push({ id: u.id, first_name: u.first_name, last_name: u.last_name, email: u.email ?? "" });
    }
  }
  return out;
}
