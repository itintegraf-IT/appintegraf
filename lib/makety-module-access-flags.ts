/** Parsování rozšířených oprávnění modulu makety (základ + vyroba + grafika + zadavatel + schvalovatelé). */

/** Úrovně v selectu administrace (write je legacy, ukládá se jako příznaky zadavatele). */
export const MAKETY_BASE_LEVELS = ["read", "write", "admin"] as const;
export const MAKETY_ADMIN_BASE_LEVELS = ["read", "admin"] as const;
export type MaketyBaseLevel = (typeof MAKETY_BASE_LEVELS)[number];

export function isModuleAccessFlag(value: unknown): boolean {
  if (value === true || value === 1) return true;
  if (typeof value === "string") {
    const v = value.toLowerCase().trim();
    return v === "1" || v === "true" || v === "yes";
  }
  return false;
}

function legacyMaketyWrite(moduleAccess: Record<string, string>): boolean {
  return moduleAccess.makety?.toLowerCase() === "write";
}

export function maketyBaseLevelFromAccess(
  moduleAccess: Record<string, string>
): MaketyBaseLevel | "" {
  const raw = moduleAccess.makety?.toLowerCase() ?? "";
  if (raw === "write") return "read";
  if (raw === "read" || raw === "admin") return raw;
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

export function hasMaketyZadavatelMaketaFlag(moduleAccess: Record<string, string>): boolean {
  if (legacyMaketyWrite(moduleAccess)) return true;
  return isModuleAccessFlag(moduleAccess.makety_zadavatel_maketa);
}

export function hasMaketyZadavatelGrafikaFlag(moduleAccess: Record<string, string>): boolean {
  if (legacyMaketyWrite(moduleAccess)) return true;
  return isModuleAccessFlag(moduleAccess.makety_zadavatel_grafika);
}

export function hasMaketySchvalovatelPrepressFlag(moduleAccess: Record<string, string>): boolean {
  return isModuleAccessFlag(moduleAccess.makety_schvalovatel_prepress);
}

export function hasMaketySchvalovatelFinalFlag(moduleAccess: Record<string, string>): boolean {
  return isModuleAccessFlag(moduleAccess.makety_schvalovatel_final);
}

export function hasMaketySpravaVzorkuFlag(moduleAccess: Record<string, string>): boolean {
  return isModuleAccessFlag(moduleAccess.makety_sprava_vzorku);
}

function anyMaketyRoleFlag(moduleAccess: Record<string, string>): boolean {
  return (
    hasMaketyVyrobaFlag(moduleAccess) ||
    hasMaketyGrafikaFlag(moduleAccess) ||
    hasMaketyZadavatelMaketaFlag(moduleAccess) ||
    hasMaketyZadavatelGrafikaFlag(moduleAccess) ||
    hasMaketySchvalovatelPrepressFlag(moduleAccess) ||
    hasMaketySchvalovatelFinalFlag(moduleAccess) ||
    hasMaketySpravaVzorkuFlag(moduleAccess)
  );
}

export function isMaketyModuleEnabled(moduleAccess: Record<string, string>): boolean {
  return (
    !!maketyBaseLevelFromAccess(moduleAccess) ||
    legacyMaketyWrite(moduleAccess) ||
    anyMaketyRoleFlag(moduleAccess) ||
    ["vyroba", "grafika"].includes(moduleAccess.makety?.toLowerCase() ?? "")
  );
}

/** Uložení z admin formuláře – legacy hodnoty převést na příznaky. */
export function normalizeMaketyModuleAccessForSave(
  moduleAccess: Record<string, string>
): Record<string, string> {
  const next = { ...moduleAccess };
  const legacyMakety = next.makety?.toLowerCase() ?? "";

  let vyroba = hasMaketyVyrobaFlag(next);
  let grafika = hasMaketyGrafikaFlag(next);
  if (legacyMakety === "vyroba") vyroba = true;
  if (legacyMakety === "grafika") grafika = true;

  let zadavatelMaketa = hasMaketyZadavatelMaketaFlag(next);
  let zadavatelGrafika = hasMaketyZadavatelGrafikaFlag(next);
  if (legacyMakety === "write") {
    zadavatelMaketa = true;
    zadavatelGrafika = true;
  }

  const schvalovatelPrepress = hasMaketySchvalovatelPrepressFlag(next);
  const schvalovatelFinal = hasMaketySchvalovatelFinalFlag(next);
  const spravaVzorku = hasMaketySpravaVzorkuFlag(next);

  let base = maketyBaseLevelFromAccess(next);
  if (legacyMakety === "admin") base = "admin";

  const needsBase =
    vyroba ||
    grafika ||
    zadavatelMaketa ||
    zadavatelGrafika ||
    schvalovatelPrepress ||
    schvalovatelFinal ||
    spravaVzorku ||
    legacyMakety === "vyroba" ||
    legacyMakety === "grafika" ||
    legacyMakety === "write";

  if (!base && needsBase) base = "read";

  if (!base && !needsBase) {
    delete next.makety;
    delete next.makety_vyroba;
    delete next.makety_grafika;
    delete next.makety_zadavatel_maketa;
    delete next.makety_zadavatel_grafika;
    delete next.makety_schvalovatel_prepress;
    delete next.makety_schvalovatel_final;
    delete next.makety_sprava_vzorku;
    return next;
  }

  next.makety = base || "read";
  if (vyroba) next.makety_vyroba = "1";
  else delete next.makety_vyroba;
  if (grafika) next.makety_grafika = "1";
  else delete next.makety_grafika;
  if (zadavatelMaketa) next.makety_zadavatel_maketa = "1";
  else delete next.makety_zadavatel_maketa;
  if (zadavatelGrafika) next.makety_zadavatel_grafika = "1";
  else delete next.makety_zadavatel_grafika;
  if (schvalovatelPrepress) next.makety_schvalovatel_prepress = "1";
  else delete next.makety_schvalovatel_prepress;
  if (schvalovatelFinal) next.makety_schvalovatel_final = "1";
  else delete next.makety_schvalovatel_final;
  if (spravaVzorku) next.makety_sprava_vzorku = "1";
  else delete next.makety_sprava_vzorku;

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

export function roleHasMaketyZadavatelMaketaFromDecoded(decoded: Record<string, unknown>): boolean {
  const perm = decoded.makety;
  if (typeof perm === "string" && perm.toLowerCase() === "write") return true;
  return isModuleAccessFlag(decoded.makety_zadavatel_maketa);
}

export function roleHasMaketyZadavatelGrafikaFromDecoded(decoded: Record<string, unknown>): boolean {
  const perm = decoded.makety;
  if (typeof perm === "string" && perm.toLowerCase() === "write") return true;
  return isModuleAccessFlag(decoded.makety_zadavatel_grafika);
}

export function roleHasMaketySchvalovatelPrepressFromDecoded(
  decoded: Record<string, unknown>
): boolean {
  return isModuleAccessFlag(decoded.makety_schvalovatel_prepress);
}

export function roleHasMaketySchvalovatelFinalFromDecoded(
  decoded: Record<string, unknown>
): boolean {
  return isModuleAccessFlag(decoded.makety_schvalovatel_final);
}

export function roleHasMaketySpravaVzorkuFromDecoded(
  decoded: Record<string, unknown>
): boolean {
  return isModuleAccessFlag(decoded.makety_sprava_vzorku);
}

function maketyBaseFromDecoded(decoded: Record<string, unknown>): string {
  const perm = decoded.makety;
  if (typeof perm !== "string") return "";
  const p = perm.toLowerCase();
  if (p === "admin") return "admin";
  if (p === "read" || p === "write") return p;
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
      roleHasMaketyGrafikaFromDecoded(decoded) ||
      roleHasMaketyZadavatelMaketaFromDecoded(decoded) ||
      roleHasMaketyZadavatelGrafikaFromDecoded(decoded) ||
      roleHasMaketySchvalovatelPrepressFromDecoded(decoded) ||
      roleHasMaketySchvalovatelFinalFromDecoded(decoded) ||
      roleHasMaketySpravaVzorkuFromDecoded(decoded)
    );
  }
  if (access === "write") {
    return (
      ["write", "admin"].includes(base) ||
      roleHasMaketyZadavatelMaketaFromDecoded(decoded) ||
      roleHasMaketyZadavatelGrafikaFromDecoded(decoded)
    );
  }
  if (access === "admin") return base === "admin";
  return false;
}
