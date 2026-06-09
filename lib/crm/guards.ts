import { AppError } from "./errors";
import { requireCrmSession, type CrmSessionUser } from "./session";

export async function requireCrmRead(): Promise<CrmSessionUser> {
  return requireCrmSession();
}

export async function requireCrmWrite(): Promise<CrmSessionUser> {
  const user = await requireCrmSession();
  if (user.role === "VIEWER") {
    throw new AppError("FORBIDDEN", "Nemáš oprávnění k této akci.");
  }
  return user;
}

export async function requireCrmAdmin(): Promise<CrmSessionUser> {
  const user = await requireCrmSession();
  if (user.role !== "ADMIN") {
    throw new AppError("FORBIDDEN", "Vyžadováno CRM admin oprávnění.");
  }
  return user;
}
