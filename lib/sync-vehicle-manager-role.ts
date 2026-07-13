import { prisma } from "@/lib/db";
import { VEHICLE_MANAGER_ROLE } from "@/lib/resource-reservation-types";

export async function getVehicleManagerRoleId(): Promise<number | null> {
  const role = await prisma.roles.findFirst({
    where: { name: VEHICLE_MANAGER_ROLE, is_active: { not: false } },
    select: { id: true },
  });
  return role?.id ?? null;
}

/** Má uživatel doplňkovou (nebo primární) roli správa vozidel. */
export async function userHasVehicleManagerRole(userId: number): Promise<boolean> {
  const roleId = await getVehicleManagerRoleId();
  if (!roleId) return false;

  const link = await prisma.user_roles.findFirst({
    where: { user_id: userId, role_id: roleId },
    select: { id: true },
  });
  if (link) return true;

  const user = await prisma.users.findUnique({
    where: { id: userId },
    select: { role_id: true },
  });
  return user?.role_id === roleId;
}

/**
 * Doplňková role správa vozidel (druhý řádek user_roles).
 * Primární role uživatele zůstává Editor/Viewer atd.
 */
export async function syncVehicleManagerRole(
  userId: number,
  enabled: boolean,
  primaryRoleId: number
): Promise<void> {
  const vehicleRoleId = await getVehicleManagerRoleId();
  if (!vehicleRoleId) return;

  if (primaryRoleId === vehicleRoleId) return;

  if (enabled) {
    await prisma.user_roles.upsert({
      where: {
        user_id_role_id: { user_id: userId, role_id: vehicleRoleId },
      },
      create: { user_id: userId, role_id: vehicleRoleId, module_access: null },
      update: {},
    });
    return;
  }

  await prisma.user_roles.deleteMany({
    where: { user_id: userId, role_id: vehicleRoleId },
  });
}

/** Zajistí roli správa vozidel u uživatelů (např. při konfiguraci schvalovatelů aut). */
export async function ensureVehicleManagerRolesForUserIds(userIds: number[]): Promise<void> {
  const vehicleRoleId = await getVehicleManagerRoleId();
  if (!vehicleRoleId) return;

  const unique = [...new Set(userIds.filter((id) => Number.isFinite(id) && id > 0))];
  for (const userId of unique) {
    const user = await prisma.users.findUnique({
      where: { id: userId },
      select: { role_id: true },
    });
    if (!user || user.role_id === vehicleRoleId) continue;

    await prisma.user_roles.upsert({
      where: {
        user_id_role_id: { user_id: userId, role_id: vehicleRoleId },
      },
      create: { user_id: userId, role_id: vehicleRoleId, module_access: null },
      update: {},
    });
  }
}

/** Uloží primární roli + module_access (odděleně od doplňkové správa vozidel). */
export async function upsertPrimaryUserRole(
  userId: number,
  primaryRoleId: number,
  moduleAccessJson: string
): Promise<void> {
  const vehicleRoleId = await getVehicleManagerRoleId();

  const primaryRows = await prisma.user_roles.findMany({
    where: {
      user_id: userId,
      ...(vehicleRoleId ? { role_id: { not: vehicleRoleId } } : {}),
    },
    orderBy: { id: "asc" },
  });

  if (primaryRows.length > 0) {
    await prisma.user_roles.update({
      where: { id: primaryRows[0].id },
      data: { role_id: primaryRoleId, module_access: moduleAccessJson },
    });
    for (let i = 1; i < primaryRows.length; i++) {
      await prisma.user_roles.delete({ where: { id: primaryRows[i].id } });
    }
    return;
  }

  await prisma.user_roles.create({
    data: { user_id: userId, role_id: primaryRoleId, module_access: moduleAccessJson },
  });
}
