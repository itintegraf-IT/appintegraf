import { prisma } from "@/lib/db";
import { getUserRoles, hasModuleAccess, isAdmin } from "@/lib/auth-utils";
import { VEHICLE_MANAGER_ROLE } from "@/lib/resource-reservation-types";

export async function isVehicleManager(userId: number): Promise<boolean> {
  if (await isAdmin(userId)) return true;
  const roles = await getUserRoles(userId);
  return roles.some((r) => r.name?.toLowerCase() === VEHICLE_MANAGER_ROLE);
}

export async function canManageResources(userId: number): Promise<boolean> {
  if (await isAdmin(userId)) return true;
  return hasModuleAccess(userId, "calendar", "admin");
}

export async function canBookResources(userId: number): Promise<boolean> {
  return hasModuleAccess(userId, "calendar", "read");
}

export async function canApproveVehicleReservation(
  userId: number,
  reservation: { approval_status: string; assigned_approver_id: number | null }
): Promise<boolean> {
  if (reservation.approval_status !== "pending") return false;
  if (!(await isVehicleManager(userId))) return false;
  if (await isAdmin(userId)) return true;
  return reservation.assigned_approver_id === userId;
}

export async function canViewReservation(
  userId: number,
  reservation: { created_by: number; assigned_approver_id: number | null }
): Promise<boolean> {
  if (reservation.created_by === userId) return true;
  if (await isAdmin(userId)) return true;
  if (await isVehicleManager(userId)) return true;
  if (reservation.assigned_approver_id === userId) return true;
  return canBookResources(userId);
}

export async function canEditReservation(
  userId: number,
  reservation: { created_by: number; approval_status: string }
): Promise<boolean> {
  if (await isAdmin(userId)) return true;
  if (reservation.created_by !== userId) return false;
  return reservation.approval_status === "pending";
}

export async function canDeleteReservation(
  userId: number,
  reservation: { created_by: number }
): Promise<boolean> {
  if (await isAdmin(userId)) return true;
  if (reservation.created_by === userId) return true;
  return isVehicleManager(userId);
}

export async function assertUsersHaveVehicleManagerRole(userIds: number[]): Promise<boolean> {
  if (userIds.length === 0) return true;
  const users = await prisma.users.findMany({
    where: { id: { in: userIds }, is_active: true },
    select: { id: true },
  });
  if (users.length !== userIds.length) return false;

  for (const id of userIds) {
    if (await isAdmin(id)) continue;
    const roles = await getUserRoles(id);
    if (!roles.some((r) => r.name?.toLowerCase() === VEHICLE_MANAGER_ROLE)) {
      return false;
    }
  }
  return true;
}
