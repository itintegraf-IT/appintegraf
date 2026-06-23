import { prisma } from "@/lib/db";

const activeDepartmentFilter = { is_active: { not: false } } as const;

/** Najde aktivní oddělení podle názvu nebo kódu (např. „IT“ → „IT oddělení“ s code IT). */
export async function findActiveDepartment(nameOrCode: string) {
  const term = nameOrCode.trim();
  if (!term) return null;

  const byName = await prisma.departments.findFirst({
    where: { name: term, ...activeDepartmentFilter },
  });
  if (byName) return byName;

  return prisma.departments.findFirst({
    where: { code: term, ...activeDepartmentFilter },
  });
}

export async function isInDepartment(userId: number, departmentName: string): Promise<boolean> {
  const dept = await findActiveDepartment(departmentName);
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
  const dept = await findActiveDepartment(departmentName);
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
