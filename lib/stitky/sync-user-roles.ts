import { prisma } from "@/lib/db";
import { stitkyRolesFromAccessRecord } from "@/lib/stitky-module-access-flags";
import type { StitkyUserRole } from "@/lib/stitky/constants";

/** Synchronizuje tabulku stitky_user_roles z module_access (po uložení uživatele v adminu). */
export async function syncStitkyUserRolesFromModuleAccess(
  userId: number,
  moduleAccess: Record<string, string>
): Promise<void> {
  const roles = stitkyRolesFromAccessRecord(moduleAccess);

  await prisma.stitky_user_roles.deleteMany({ where: { user_id: userId } });

  for (const role of roles) {
    await prisma.stitky_user_roles.create({
      data: { user_id: userId, role },
    });
  }
}

export type { StitkyUserRole };
