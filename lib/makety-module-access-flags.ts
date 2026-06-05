/** Parsování rozšířených oprávnění modulu makety (základ + vyroba + grafika). */

export const MAKETY_BASE_LEVELS = ["read", "write", "admin"] as const;
export type MaketyBaseLevel = (typeof MAKETY_BASE_LEVELS)[number];

export function isModuleAccessFlag(value: unknown): boolean {
  if (value === true || value === 1) return true;
  if (typeof value === "string") {
    const v = value.toLowerCase().trim();
    return v === "1" || v === "true" || v === "yes";
  }
  return false;
}

export function maketyBaseLevelFromAccess(
  moduleAccess: Record<string, string>
): MaketyBaseLevel | "" {
  const raw = moduleAccess.makety?.toLowerCase() ?? "";
  if (MAKETY_BASE_LEVELS.includes(raw as MaketyBaseLevel)) return raw as MaketyBaseLevel;
  return "";
}

export function hasMaketyVyrobaFlag(moduleAccess: Record<string, string>): boolean {
  const raw = moduleAccess.makety?.toLowerCase() ?? "";
  if (raw === "vyroba") return true;
  return isModuleAccessFlag(moduleAccess.makety_vyroba);
}

export function hasMaketyGrafikaFlag(moduleAccess: Record<string, string>): boolean {
  const raw = moduleAccess.makety?.toLowerCase() ?? "";
  if (raw === "grafika") return true;
  return isModuleAccessFlag(moduleAccess.makety_grafika);
}

export function isMaketyModuleEnabled(moduleAccess: Record<string, string>): boolean {
  return (
    !!maketyBaseLevelFromAccess(moduleAccess) ||
    hasMaketyVyrobaFlag(moduleAccess) ||
    hasMaketyGrafikaFlag(moduleAccess) ||
    ["vyroba", "grafika"].includes(moduleAccess.makety?.toLowerCase() ?? "")
  );
}

/** Uložení z admin formuláře – legacy hodnoty vyroba/grafika v `makety` převést na příznaky. */
export function normalizeMaketyModuleAccessForSave(
  moduleAccess: Record<string, string>
): Record<string, string> {
  const next = { ...moduleAccess };
  const legacyMakety = next.makety?.toLowerCase() ?? "";

  let vyroba = hasMaketyVyrobaFlag(next);
  let grafika = hasMaketyGrafikaFlag(next);
  if (legacyMakety === "vyroba") vyroba = true;
  if (legacyMakety === "grafika") grafika = true;

  let base = maketyBaseLevelFromAccess(next);
  if (!base && (vyroba || grafika || legacyMakety === "vyroba" || legacyMakety === "grafika")) {
    base = "read";
  }

  if (!base && !vyroba && !grafika) {
    delete next.makety;
    delete next.makety_vyroba;
    delete next.makety_grafika;
    return next;
  }

  next.makety = base || "read";
  if (vyroba) next.makety_vyroba = "1";
  else delete next.makety_vyroba;
  if (grafika) next.makety_grafika = "1";
  else delete next.makety_grafika;

  return next;
}

export function roleHasMaketyVyrobaFromDecoded(decoded: Record<string, unknown>): boolean {
  const perm = decoded.makety;
  if (typeof perm === "string" && perm.toLowerCase() === "vyroba") return true;
  return isModuleAccessFlag(decoded.makety_vyroba);
}

export function roleHasMaketyGrafikaFromDecoded(decoded: Record<string, unknown>): boolean {
  const perm = decoded.makety;
  if (typeof perm === "string" && perm.toLowerCase() === "grafika") return true;
  return isModuleAccessFlag(decoded.makety_grafika);
}

function maketyBaseFromDecoded(decoded: Record<string, unknown>): string {
  const perm = decoded.makety;
  if (typeof perm !== "string") return "";
  const p = perm.toLowerCase();
  if (MAKETY_BASE_LEVELS.includes(p as MaketyBaseLevel)) return p;
  return "";
}

export function roleMaketyGrantsModuleAccess(
  decoded: Record<string, unknown>,
  access: "read" | "write" | "admin"
): boolean {
  const base = maketyBaseFromDecoded(decoded);
  if (access === "read") {
    return (
      ["read", "write", "admin"].includes(base) ||
      roleHasMaketyVyrobaFromDecoded(decoded) ||
      roleHasMaketyGrafikaFromDecoded(decoded)
    );
  }
  if (access === "write") return ["write", "admin"].includes(base);
  if (access === "admin") return base === "admin";
  return false;
}
