import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getCrmRole, type CrmRole } from "./permissions";

export type CrmSessionUser = {
  id: number;
  role: CrmRole;
};

export async function getCrmSession(): Promise<CrmSessionUser | null> {
  const session = await auth();
  if (!session?.user?.id) return null;
  const userId = parseInt(session.user.id, 10);
  if (Number.isNaN(userId) || userId <= 0) return null;
  const role = await getCrmRole(userId);
  if (!role) return null;
  return { id: userId, role };
}

export async function requireCrmSession(): Promise<CrmSessionUser> {
  const user = await getCrmSession();
  if (!user) redirect("/login");
  return user;
}
