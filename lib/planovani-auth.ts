/**
 * Mapování oprávnění modulu Plánování výroby na role z PlanovaniVyroby.
 * Správa uživatelů: NextAuth + module_access v user_roles.
 *
 * Klíče module_access (objekt): planovani: read|write|admin|tiskar,
 * planovani_machine nebo planovani_tiskar_machine: XL_105 | XL_106 (pro tiskaře),
 * planovani.admin, planovani.planovac, planovani.mtz, planovani.dtp
 */
import { prisma } from "@/lib/db";
import { getModuleAccessItems, isAdmin } from "./auth-utils";

export type PlanovaniRole = "ADMIN" | "PLANOVAT" | "MTZ" | "DTP" | "VIEWER" | "TISKAR";

export interface PlanovaniSession {
  id: number;
  username: string;
  role: PlanovaniRole;
}

function hasItem(items: string[], ...keys: string[]): boolean {
  const set = new Set(items);
  return keys.some((k: string) => set.has(k.toLowerCase()));
}

/** Sloučí objektové module_access ze všech user_roles (pozdější přepíše dřívější). */
async function getMergedModuleAccessRecord(userId: number): Promise<Record<string, unknown>> {
  const userRoles = await prisma.user_roles.findMany({
    where: { user_id: userId },
    select: { module_access: true },
    orderBy: { id: "asc" },
  });
  const merged: Record<string, unknown> = {};
  for (const ur of userRoles) {
    const raw = ur.module_access;
    if (raw == null) continue;
    try {
      const decoded = typeof raw === "string" ? JSON.parse(raw) : raw;
      if (decoded && typeof decoded === "object" && !Array.isArray(decoded)) {
        Object.assign(merged, decoded as Record<string, unknown>);
      }
    } catch {
      /* ignore */
    }
  }
  if (Object.keys(merged).length === 0) {
    const user = await prisma.users.findUnique({
      where: { id: userId },
      select: { roles: { select: { permissions: true } } },
    });
    const perm = user?.roles?.permissions;
    if (typeof perm === "string") {
      try {
        const decoded = JSON.parse(perm);
        if (decoded && typeof decoded === "object" && !Array.isArray(decoded)) {
          Object.assign(merged, decoded as Record<string, unknown>);
        }
      } catch {
        /* ignore */
      }
    }
  }
  return merged;
}

/**
 * Stroj přiřazený tiskaři z module_access (planovani_machine nebo planovani_tiskar_machine).
 */
export async function getPlanovaniAssignedMachine(userId: number): Promise<string | null> {
  const m = await getMergedModuleAccessRecord(userId);
  const v = m.planovani_machine ?? m.planovani_tiskar_machine;
  if (typeof v !== "string") return null;
  const s = v.trim();
  return s || null;
}

export async function getPlanovaniRole(userId: number): Promise<PlanovaniRole> {
  if (await isAdmin(userId)) return "ADMIN";
  const items = await getModuleAccessItems(userId);
  if (hasItem(items, "planovani.admin")) return "ADMIN";
  if (hasItem(items, "planovani:tiskar")) return "TISKAR";
  if (hasItem(items, "planovani.planovac", "planovani.write")) return "PLANOVAT";
  if (hasItem(items, "planovani.mtz")) return "MTZ";
  if (hasItem(items, "planovani.dtp")) return "DTP";
  if (hasItem(items, "planovani", "planovani.read", "planovani.view")) return "VIEWER";
  return "VIEWER";
}

export async function getPlanovaniDtpMtzUsernames(): Promise<string[]> {
  const users = await prisma.users.findMany({
    where: { is_active: true },
    select: { id: true, username: true },
  });
  const usernames: string[] = [];
  for (const u of users) {
    const role = await getPlanovaniRole(u.id);
    if (role === "DTP" || role === "MTZ") {
      usernames.push(u.username);
    }
  }
  return usernames;
}

export async function hasPlanovaniAccess(userId: number): Promise<boolean> {
  if (await isAdmin(userId)) return true;
  const items = await getModuleAccessItems(userId);
  return hasItem(
    items,
    "planovani",
    "planovani.admin",
    "planovani.planovac",
    "planovani.mtz",
    "planovani.dtp",
    "planovani.read",
    "planovani.view",
    "planovani:tiskar"
  );
}
