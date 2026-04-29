import { prisma } from "@/lib/db";

export type PhoneListDeptMember = { first_name: string; last_name: string };

type DeptMin = { id: number; name: string };

type UserForDept = {
  id: number;
  first_name: string;
  last_name: string;
  department_id: number | null;
  department_name: string | null;
  user_secondary_departments: { department_id: number }[];
};

function userBelongsToDepartment(u: UserForDept, d: DeptMin): boolean {
  if (u.department_id === d.id) return true;
  if (u.user_secondary_departments.some((s) => s.department_id === d.id)) return true;
  if (u.department_id == null && u.department_name != null && u.department_name === d.name) {
    return true;
  }
  return false;
}

/** Přiřadí k oddělením seznam členů (telefonní seznam – aktivní, zobrazení v seznamu). */
export async function attachMembersToDepartments<T extends DeptMin>(
  departments: T[]
): Promise<(T & { members: PhoneListDeptMember[] })[]> {
  if (departments.length === 0) return [];

  const deptIds = departments.map((d) => d.id);
  const deptNames = [...new Set(departments.map((d) => d.name))];

  const memberUsers = await prisma.users.findMany({
    where: {
      AND: [
        { OR: [{ is_active: true }, { is_active: null }] },
        { OR: [{ display_in_list: true }, { display_in_list: null }] },
        {
          OR: [
            { department_id: { in: deptIds } },
            {
              user_secondary_departments: {
                some: { department_id: { in: deptIds } },
              },
            },
            {
              AND: [{ department_id: null }, { department_name: { in: deptNames } }],
            },
          ],
        },
      ],
    },
    select: {
      id: true,
      first_name: true,
      last_name: true,
      department_id: true,
      department_name: true,
      user_secondary_departments: { select: { department_id: true } },
    },
    orderBy: [{ last_name: "asc" }, { first_name: "asc" }],
  });

  const byDept = new Map<number, Map<number, PhoneListDeptMember>>();
  for (const d of departments) {
    byDept.set(d.id, new Map());
  }

  for (const u of memberUsers) {
    for (const d of departments) {
      if (!userBelongsToDepartment(u, d)) continue;
      const m = byDept.get(d.id)!;
      if (m.has(u.id)) continue;
      m.set(u.id, { first_name: u.first_name, last_name: u.last_name });
    }
  }

  return departments.map((d) => ({
    ...d,
    members: Array.from(byDept.get(d.id)!.values()),
  }));
}
