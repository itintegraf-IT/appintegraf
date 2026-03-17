/**
 * Mapování oprávnění modulu Plánování výroby na role z původního PlanovaniVyroby.
 * Správa uživatelů přebírá APPIntegrafNEXTJS (NextAuth), role se mapují z module_access.
 *
 * Oprávnění v module_access: planovani, planovani.admin, planovani.planovac,
 * planovani.mtz, planovani.dtp
 */
import { getModuleAccessItems, isAdmin } from "./auth-utils";

export type PlanovaniRole = "ADMIN" | "PLANOVAT" | "MTZ" | "DTP" | "VIEWER";

export interface PlanovaniSession {
  id: number;
  username: string;
  role: PlanovaniRole;
}

function hasItem(items: string[], ...keys: string[]): boolean {
  const set = new Set(items);
  return keys.some((k) => set.has(k.toLowerCase()));
}

/**
 * Vrátí roli uživatele pro modul plánování výroby.
 */
export async function getPlanovaniRole(userId: number): Promise<PlanovaniRole> {
  if (await isAdmin(userId)) return "ADMIN";
  const items = await getModuleAccessItems(userId);
  if (hasItem(items, "planovani.admin")) return "ADMIN";
  if (hasItem(items, "planovani.planovac", "planovani.write")) return "PLANOVAT";
  if (hasItem(items, "planovani.mtz")) return "MTZ";
  if (hasItem(items, "planovani.dtp")) return "DTP";
  if (hasItem(items, "planovani", "planovani.read", "planovani.view")) return "VIEWER";
  return "VIEWER";
}

/**
 * Vrátí seznam uživatelských jmen uživatelů s rolí DTP nebo MTZ v modulu plánování.
 * Používá se pro filtr "DTP + MTZ aktivita" v audit/today.
 */
export async function getPlanovaniDtpMtzUsernames(): Promise<string[]> {
  const { prisma } = await import("@/lib/db");
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

/**
 * Kontrola, zda má uživatel přístup k modulu plánování (alespoň VIEWER).
 */
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
    "planovani.view"
  );
}
