import { prisma } from "@/lib/db";

export type ModuleAccess = "read" | "write" | "admin";

/**
 * Načte role uživatele včetně module_access (user_roles nebo fallback na users.role_id)
 */
async function getUserRoles(userId: number) {
  const userRoles = await prisma.user_roles.findMany({
    where: { user_id: userId },
    include: { roles: true },
  });

  if (userRoles.length > 0) {
    type UserRoleRow = (typeof userRoles)[number];
    return userRoles.map((ur: UserRoleRow) => ({
      name: ur.roles.name,
      module_access: ur.module_access,
    }));
  }

  // Fallback: users.role_id
  const user = await prisma.users.findUnique({
    where: { id: userId },
    include: { roles: true },
  });

  if (user?.roles) {
    return [{ name: user.roles.name, module_access: user.roles.permissions as string | null }];
  }

  return [];
}

/**
 * Vrátí seznam oprávnění z module_access (pro kontrolu specifických stringů).
 */
export async function getModuleAccessItems(userId: number): Promise<string[]> {
  const roles = await getUserRoles(userId);
  const items: string[] = [];
  for (const role of roles) {
    const raw = role.module_access;
    if (raw === null || raw === undefined) continue;
    let decoded: unknown;
    try {
      decoded = typeof raw === "string" ? JSON.parse(raw) : raw;
    } catch {
      continue;
    }
    if (Array.isArray(decoded)) {
      for (const x of decoded) {
        if (typeof x === "string") items.push(x.toLowerCase().trim());
      }
    } else if (decoded && typeof decoded === "object") {
      for (const [k, v] of Object.entries(decoded)) {
        if (typeof v === "string") items.push(`${k.toLowerCase()}:${v.toLowerCase()}`);
        else if (v === true) items.push(k.toLowerCase());
      }
    }
  }
  return [...new Set(items)];
}

/**
 * Kontrola, zda má uživatel přístup k modulu (kompatibilní s PHP hasModuleAccess)
 */
export async function hasModuleAccess(
  userId: number,
  module: string,
  access: ModuleAccess = "read"
): Promise<boolean> {
  const roles = await getUserRoles(userId);

  for (const role of roles) {
    if (role.name?.toLowerCase() === "admin") return true;

    const rawAccess = role.module_access;
    if (rawAccess === null || rawAccess === undefined) continue;

    let decoded: unknown = rawAccess;
    if (typeof rawAccess === "string") {
      try {
        decoded = JSON.parse(rawAccess);
      } catch {
        decoded = rawAccess;
      }
    }

    // Per-module úroveň: { "contacts": "read", "equipment": "write", ... }
    if (decoded && typeof decoded === "object" && !Array.isArray(decoded)) {
      const perm = (decoded as Record<string, unknown>)[module];
      if (perm === true) return true;
      if (typeof perm === "string") {
        const p = perm.toLowerCase();
        const planovaniTiskar = module === "planovani" && p === "tiskar";
        if (access === "read" && (["read", "write", "admin"].includes(p) || planovaniTiskar)) return true;
        if (access === "write" && ["write", "admin"].includes(p)) return true;
        if (access === "admin" && p === "admin") return true;
      }
    }

    if (Array.isArray(decoded)) {
      const moduleLower = module.toLowerCase();
      for (const item of decoded) {
        if (typeof item !== "string") continue;
        const itemLower = item.toLowerCase().trim();
        if (itemLower === moduleLower || itemLower === `${moduleLower}.view` || itemLower === `${moduleLower}.read`) {
          if (access === "read") return true;
        }
        if (
          [`${moduleLower}.write`, `${moduleLower}.add`, `${moduleLower}.edit`, `${moduleLower}.delete`].includes(
            itemLower
          )
        ) {
          return true;
        }
      }
    }
  }

  return false;
}

/**
 * Kontrola, zda má uživatel admin roli
 */
export async function isAdmin(userId: number): Promise<boolean> {
  const roles = await getUserRoles(userId);
  type RoleItem = (typeof roles)[number];
  return roles.some((r: RoleItem) => r.name?.toLowerCase() === "admin");
}

/**
 * Vrátí ID uživatelů, kteří mají admin oprávnění pro daný modul (např. "equipment" = Majetek).
 * Použito pro notifikace při nových požadavcích.
 */
export async function getUsersWithModuleAdmin(module: string): Promise<number[]> {
  const userRolesData = await prisma.user_roles.findMany({
    where: { users: { is_active: true } },
    include: { roles: true, users: { select: { id: true } } },
  });

  const usersWithFallbackRole = await prisma.users.findMany({
    where: {
      is_active: true,
      role_id: { not: null },
      user_roles: { none: {} },
    },
    include: { roles: true },
  });

  const hasAdminInRoles = (roles: { name: string | null; module_access: string | null }[]) =>
    roles.some((r: { name: string | null }) => r.name?.toLowerCase() === "admin") ||
    hasModuleAccessFromRoles(roles, module, "admin");

  const adminIds = new Set<number>();

  for (const ur of userRolesData) {
    const roles = [{ name: ur.roles.name, module_access: ur.module_access }];
    if (hasAdminInRoles(roles)) adminIds.add(ur.users.id);
  }

  for (const u of usersWithFallbackRole) {
    if (!u.roles) continue;
    const roles = [{ name: u.roles.name, module_access: u.roles.permissions as string | null }];
    if (hasAdminInRoles(roles)) adminIds.add(u.id);
  }

  return [...adminIds];
}

/**
 * Vrátí seznam uživatelů, kteří mají přístup k danému modulu.
 * Použito pro výběr baliče v modulu Výroba.
 */
export async function getUsersWithModuleAccess(
  module: string,
  access: ModuleAccess = "read"
): Promise<{ id: number; name: string }[]> {
  const userRolesData = await prisma.user_roles.findMany({
    where: { users: { is_active: true } },
    include: { roles: true, users: { select: { id: true, first_name: true, last_name: true } } },
  });

  const usersWithFallbackRole = await prisma.users.findMany({
    where: {
      is_active: true,
      role_id: { not: null },
      user_roles: { none: {} },
    },
    include: { roles: true },
  });

  const hasAccess = (roles: { name: string | null; module_access: string | null }[]) =>
    roles.some((r: { name: string | null }) => r.name?.toLowerCase() === "admin") ||
    hasModuleAccessFromRoles(roles, module, access);

  const result: { id: number; name: string }[] = [];
  const seen = new Set<number>();

  for (const ur of userRolesData) {
    const roles = [{ name: ur.roles.name, module_access: ur.module_access }];
    if (hasAccess(roles) && !seen.has(ur.users.id)) {
      seen.add(ur.users.id);
      result.push({
        id: ur.users.id,
        name: `${ur.users.first_name} ${ur.users.last_name}`.trim() || ur.users.id.toString(),
      });
    }
  }

  for (const u of usersWithFallbackRole) {
    if (!u.roles || seen.has(u.id)) continue;
    const roles = [{ name: u.roles.name, module_access: u.roles.permissions as string | null }];
    if (hasAccess(roles)) {
      seen.add(u.id);
      result.push({
        id: u.id,
        name: `${u.first_name} ${u.last_name}`.trim() || u.id.toString(),
      });
    }
  }

  result.sort((a, b) => a.name.localeCompare(b.name));
  return result;
}

/**
 * Načte admin status a přístup ke všem modulům v jednom DB dotazu.
 * Použít v layoutu místo 6 samostatných volání.
 */
export async function getLayoutAccess(userId: number): Promise<{
  admin: boolean;
  contacts: boolean;
  equipment: boolean;
  calendar: boolean;
  kiosk: boolean;
  training: boolean;
  planovani: boolean;
  iml: boolean;
  vyroba: boolean;
}> {
  const roles = await getUserRoles(userId);
  type RoleItem = (typeof roles)[number];
  const admin = roles.some((r: RoleItem) => r.name?.toLowerCase() === "admin");

  const checkModule = (module: string) =>
    admin || hasModuleAccessFromRoles(roles, module, "read");

  return {
    admin,
    contacts: checkModule("contacts"),
    equipment: checkModule("equipment"),
    calendar: checkModule("calendar"),
    kiosk: checkModule("kiosk"),
    training: checkModule("training"),
    planovani: checkModule("planovani"),
    iml: checkModule("iml"),
    vyroba: checkModule("vyroba"),
  };
}

function hasModuleAccessFromRoles(
  roles: { name: string | null; module_access: string | null }[],
  module: string,
  access: ModuleAccess
): boolean {
  for (const role of roles) {
    const rawAccess = role.module_access;
    if (rawAccess === null || rawAccess === undefined) continue;

    let decoded: unknown = rawAccess;
    if (typeof rawAccess === "string") {
      try {
        decoded = JSON.parse(rawAccess);
      } catch {
        decoded = rawAccess;
      }
    }

    if (decoded && typeof decoded === "object" && !Array.isArray(decoded)) {
      const perm = (decoded as Record<string, unknown>)[module];
      if (perm === true) return true;
      if (typeof perm === "string") {
        const p = perm.toLowerCase();
        const planovaniTiskar = module === "planovani" && p === "tiskar";
        if (access === "read" && (["read", "write", "admin"].includes(p) || planovaniTiskar)) return true;
        if (access === "write" && ["write", "admin"].includes(p)) return true;
        if (access === "admin" && p === "admin") return true;
      }
    }

    if (Array.isArray(decoded)) {
      const moduleLower = module.toLowerCase();
      for (const item of decoded) {
        if (typeof item !== "string") continue;
        const itemLower = item.toLowerCase().trim();
        if (itemLower === moduleLower || itemLower === `${moduleLower}.view` || itemLower === `${moduleLower}.read`) {
          if (access === "read") return true;
        }
        if (
          [`${moduleLower}.write`, `${moduleLower}.add`, `${moduleLower}.edit`, `${moduleLower}.delete`].includes(
            itemLower
          )
        ) {
          return true;
        }
      }
    }
  }
  return false;
}
