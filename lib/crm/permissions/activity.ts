import type { Role } from "@/lib/crm/rbac";

type CurrentUser = { id: number; role: Role };
type ActivityRef = { owner_id: number; assignee_id: number | null };

export function canEditActivity(user: CurrentUser, activity: ActivityRef): boolean {
  if (user.role === "VIEWER") return false;
  if (user.role === "ADMIN") return true;
  return activity.owner_id === user.id;
}

export function canDeleteActivity(user: CurrentUser, activity: ActivityRef): boolean {
  return canEditActivity(user, activity);
}
