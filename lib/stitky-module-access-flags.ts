/** Parsování rozšířených oprávnění modulu Štítky (základ + tiskař + mistr). */

import { isModuleAccessFlag } from "@/lib/makety-module-access-flags";
import type { StitkyUserRole } from "@/lib/stitky/constants";

export const STITKY_BASE_LEVELS = ["read", "write", "admin"] as const;
export type StitkyBaseLevel = (typeof STITKY_BASE_LEVELS)[number];

export function stitkyBaseLevelFromAccess(
  moduleAccess: Record<string, string>
): StitkyBaseLevel | "" {
  const raw = moduleAccess.stitky?.toLowerCase() ?? "";
  if (STITKY_BASE_LEVELS.includes(raw as StitkyBaseLevel)) return raw as StitkyBaseLevel;
  return "";
}

export function hasStitkyTiskarFlag(moduleAccess: Record<string, string>): boolean {
  return isModuleAccessFlag(moduleAccess.stitky_tiskar);
}

export function hasStitkyMistrFlag(moduleAccess: Record<string, string>): boolean {
  return isModuleAccessFlag(moduleAccess.stitky_mistr);
}

export function isStitkyModuleEnabled(moduleAccess: Record<string, string>): boolean {
  return (
    !!stitkyBaseLevelFromAccess(moduleAccess) ||
    hasStitkyTiskarFlag(moduleAccess) ||
    hasStitkyMistrFlag(moduleAccess)
  );
}

/** Odvozené role pro audit / zobrazení — zadavatel = write/admin. */
export function stitkyRolesFromAccessRecord(
  moduleAccess: Record<string, string>
): StitkyUserRole[] {
  const roles: StitkyUserRole[] = [];
  const base = stitkyBaseLevelFromAccess(moduleAccess);
  if (base === "write" || base === "admin") roles.push("ZADAVATEL");
  if (hasStitkyTiskarFlag(moduleAccess)) roles.push("TISKAR");
  if (hasStitkyMistrFlag(moduleAccess)) roles.push("MISTER");
  return roles;
}

export function normalizeStitkyModuleAccessForSave(
  moduleAccess: Record<string, string>
): Record<string, string> {
  const next = { ...moduleAccess };

  let tiskar = hasStitkyTiskarFlag(next);
  let mistr = hasStitkyMistrFlag(next);
  let base = stitkyBaseLevelFromAccess(next);

  if (!base && (tiskar || mistr)) {
    base = "read";
  }

  if (!base && !tiskar && !mistr) {
    delete next.stitky;
    delete next.stitky_tiskar;
    delete next.stitky_mistr;
    return next;
  }

  next.stitky = base || "read";
  if (tiskar) next.stitky_tiskar = "1";
  else delete next.stitky_tiskar;
  if (mistr) next.stitky_mistr = "1";
  else delete next.stitky_mistr;

  return next;
}

export function roleHasStitkyTiskarFromDecoded(decoded: Record<string, unknown>): boolean {
  return isModuleAccessFlag(decoded.stitky_tiskar);
}

export function roleHasStitkyMistrFromDecoded(decoded: Record<string, unknown>): boolean {
  return isModuleAccessFlag(decoded.stitky_mistr);
}

function stitkyBaseFromDecoded(decoded: Record<string, unknown>): string {
  const perm = decoded.stitky;
  if (typeof perm !== "string") return "";
  const p = perm.toLowerCase();
  if (STITKY_BASE_LEVELS.includes(p as StitkyBaseLevel)) return p;
  return "";
}

export function roleStitkyGrantsModuleAccess(
  decoded: Record<string, unknown>,
  access: "read" | "write" | "admin"
): boolean {
  const base = stitkyBaseFromDecoded(decoded);
  if (access === "read") {
    return (
      ["read", "write", "admin"].includes(base) ||
      roleHasStitkyTiskarFromDecoded(decoded) ||
      roleHasStitkyMistrFromDecoded(decoded)
    );
  }
  if (access === "write") return ["write", "admin"].includes(base);
  if (access === "admin") return base === "admin";
  return false;
}

/** Shrnutí rolí pro admin přehled uživatelů (client-safe, bez DB). */
export function stitkyRoleSummary(moduleAccess: Record<string, string>): string {
  const parts: string[] = [];
  const base = moduleAccess.stitky?.toLowerCase();
  if (base === "read") parts.push("prohlížení");
  if (base === "write") parts.push("zadavatel");
  if (base === "admin") parts.push("admin");
  if (moduleAccess.stitky_tiskar === "1") parts.push("tiskař");
  if (moduleAccess.stitky_mistr === "1") parts.push("mistr");
  return parts.length > 0 ? parts.join(", ") : "—";
}
