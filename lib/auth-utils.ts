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
    return userRoles.map((ur) => ({
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

    if (Array.isArray(decoded)) {
      if (decoded.includes("*") || (decoded as unknown[]).some((x) => x === true && typeof x === "object")) continue;
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

    if (decoded && typeof decoded === "object" && !Array.isArray(decoded)) {
      const perm = (decoded as Record<string, unknown>)[module];
      if (perm === true) return true;
      if (typeof perm === "string") {
        const p = perm.toLowerCase();
        if (p === access || (p === "write" && access === "read")) return true;
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
  return roles.some((r) => r.name?.toLowerCase() === "admin");
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
}> {
  const roles = await getUserRoles(userId);
  const admin = roles.some((r) => r.name?.toLowerCase() === "admin");

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

    if (decoded && typeof decoded === "object" && !Array.isArray(decoded)) {
      const perm = (decoded as Record<string, unknown>)[module];
      if (perm === true) return true;
      if (typeof perm === "string") {
        const p = perm.toLowerCase();
        if (p === access || (p === "write" && access === "read")) return true;
      }
    }
  }
  return false;
}
