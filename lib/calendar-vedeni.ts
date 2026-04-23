import { prisma } from "@/lib/db";

/** Uživatel v primárním nebo sekundárním oddělení „Vedení“ (dle záznamu v DB). */
export async function isUserInVedeniDepartment(userId: number): Promise<boolean> {
  if (userId <= 0) return false;
  const ved = await prisma.departments.findFirst({
    where: { name: "Vedení", is_active: true },
    select: { id: true },
  });
  if (!ved) return false;
  const u = await prisma.users.findFirst({
    where: {
      id: userId,
      OR: [
        { department_id: ved.id },
        { user_secondary_departments: { some: { department_id: ved.id } } },
      ],
    },
    select: { id: true },
  });
  return !!u;
}
