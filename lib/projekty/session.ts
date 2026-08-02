import { auth } from "@/auth";
import { hasModuleAccess, isAdmin } from "@/lib/auth-utils";
import { AppError } from "./errors";
import type { Role, SessionUser } from "./rbac";

/**
 * Session adaptér modulu Projekty.
 *
 * Nahrazuje původní NextAuth/passthrough vrstvu PM Toolu. Identitu bere z
 * appintegraf loginu (auth()) a workspace-level roli PM odvozuje z oprávnění
 * modulu "projekty":
 *   - appintegraf admin           → ADMIN
 *   - write na modulu "projekty"  → MEMBER
 *   - read na modulu "projekty"   → VIEWER
 *   - jinak (bez přístupu)        → null (getSession vrátí null → 401)
 *
 * Board-level role (BoardRole ADMIN/MEMBER/OBSERVER) řeší rbac.ts uvnitř modulu.
 */
export async function getSession(): Promise<SessionUser | null> {
  const session = await auth();
  const rawId = session?.user?.id;
  if (!rawId) return null;

  const id = parseInt(rawId, 10);
  if (!Number.isFinite(id)) return null;

  let role: Role;
  if (await isAdmin(id)) {
    role = "ADMIN";
  } else if (await hasModuleAccess(id, "projekty", "write")) {
    role = "MEMBER";
  } else if (await hasModuleAccess(id, "projekty", "read")) {
    role = "VIEWER";
  } else {
    return null; // přihlášen, ale bez přístupu k modulu Projekty
  }

  return {
    id,
    email: session?.user?.email ?? null,
    role,
  };
}

export async function requireSession(): Promise<SessionUser> {
  const user = await getSession();
  if (!user) throw new AppError("UNAUTHORIZED", "Musíš být přihlášený.");
  return user;
}

export async function requireRole(allowed: Role[]): Promise<SessionUser> {
  const user = await requireSession();
  if (!allowed.includes(user.role)) {
    throw new AppError("FORBIDDEN", "Nemáš oprávnění k této akci.");
  }
  return user;
}
