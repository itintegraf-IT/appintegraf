import { HELP_REGISTRY, type HelpEntry } from "./help-registry";

/**
 * Pořadí prefixů cest a klíčů v registru.
 * Důležité: delší prefixy musí být první (např. „/equipment/prirazeni" → „equipment").
 */
const PATH_PREFIX_MAP: { prefix: string; key: string }[] = [
  { prefix: "/calendar", key: "calendar" },
  { prefix: "/contacts", key: "contacts" },
  { prefix: "/equipment", key: "equipment" },
  { prefix: "/ukoly", key: "ukoly" },
  { prefix: "/personalistika", key: "personalistika" },
  { prefix: "/contracts", key: "contracts" },
  { prefix: "/planovani", key: "planovani" },
  { prefix: "/vyroba", key: "vyroba" },
  { prefix: "/iml", key: "iml" },
  { prefix: "/kiosk", key: "kiosk" },
  { prefix: "/phone-list", key: "phone-list" },
  { prefix: "/training", key: "training" },
  { prefix: "/admin", key: "admin" },
  { prefix: "/profile", key: "profile" },
  { prefix: "/settings", key: "settings" },
];

/** Vrátí klíč nápovědy pro danou pathname. Pro „/" vrací „dashboard". */
export function resolveHelpKey(pathname: string): string {
  if (!pathname || pathname === "/") return "dashboard";
  const match = PATH_PREFIX_MAP.find(
    ({ prefix }) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
  return match?.key ?? "fallback";
}

/** Vrátí HelpEntry pro pathname (s případným fallbackem). */
export function resolveHelpEntry(pathname: string): HelpEntry {
  const key = resolveHelpKey(pathname);
  return HELP_REGISTRY[key] ?? HELP_REGISTRY.fallback;
}

/**
 * Filtruje HelpEntry, ke kterým má uživatel přístup.
 * Hodí se pro „přepínač modulů" v drawer panelu.
 */
export function getAccessibleHelpEntries(
  moduleAccess: Record<string, boolean>,
  isAdmin: boolean
): HelpEntry[] {
  return Object.values(HELP_REGISTRY)
    .filter((e) => e.key !== "fallback")
    .filter((e) => {
      if (e.requiresAdmin && !isAdmin) return false;
      if (e.module && !moduleAccess[e.module]) return false;
      return true;
    });
}
