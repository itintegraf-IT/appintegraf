/**
 * Platformová detekce pro zobrazení klávesových zkratek.
 *
 * Appka běží převážně na Windows — default (SSR, neznámá platforma) je proto
 * VŽDY Ctrl varianta; ⌘ se zobrazí až po klientské detekci macu. Funkční
 * handlery zkratek na tomhle nezávisí — vždy testují (metaKey || ctrlKey).
 */

type NavigatorUAData = { platform?: string };

export function detectIsMac(): boolean {
  if (typeof navigator === "undefined") return false;
  const uaPlatform =
    (navigator as Navigator & { userAgentData?: NavigatorUAData }).userAgentData
      ?.platform ?? navigator.platform;
  return /Mac|iPhone|iPad|iPod/i.test(uaPlatform ?? "");
}

const MAC_KEYS: Record<string, string> = {
  mod: "⌘",
  shift: "⇧",
  alt: "⌥",
  ctrl: "⌃",
  enter: "↵",
  esc: "Esc",
};

const WIN_KEYS: Record<string, string> = {
  mod: "Ctrl",
  shift: "Shift",
  alt: "Alt",
  ctrl: "Ctrl",
  enter: "Enter",
  esc: "Esc",
};

/**
 * Převod specifikace zkratky ("mod+K", "mod+shift+K") na zobrazitelný text.
 * mac: "⌘K", "⌘⇧K" (bez oddělovačů, konvence Apple); jinak "Ctrl+K",
 * "Ctrl+Shift+K". Neznámé klíče projdou beze změny (uppercase u písmen).
 */
export function formatShortcut(spec: string, isMac: boolean): string {
  const table = isMac ? MAC_KEYS : WIN_KEYS;
  const parts = spec.split("+").map((raw) => {
    const key = raw.trim();
    const mapped = table[key.toLowerCase()];
    if (mapped) return mapped;
    return key.length === 1 ? key.toUpperCase() : key;
  });
  return parts.join(isMac ? "" : "+");
}
