/**
 * Whitelist slug → soubor v docs/ pro /help/[slug].
 * Pouze tyto slugy lze načíst – žádné path traversal z URL.
 */
export const HELP_DOC_SLUGS: Record<
  string,
  { file: string; title: string }
> = {
  "manual-moduly-hotove": {
    file: "MANUAL_MODULY_HOTOVE.md",
    title: "Stručný manuál hotových modulů",
  },
  "kalendar-navod-uzivatel": {
    file: "KALENDAR_NAVOD_UZIVATEL.md",
    title: "Kalendář – návod pro uživatele",
  },
  "modul-kalendar": {
    file: "MODUL_KALENDAR.md",
    title: "Modul Kalendář – dokumentace",
  },
  "kalendar-schvalovani-faze2": {
    file: "KALENDAR_SCHVALOVANI_FAZE2.md",
    title: "Kalendář – dvoufázové schvalování",
  },
  "modul-majetek-pozadavky": {
    file: "MODUL_MAJETEK_POZADAVKY.md",
    title: "Majetek – požadavky na techniku",
  },
  "modul-ukoly": {
    file: "MODUL_UKOLY.md",
    title: "Modul Úkoly – dokumentace",
  },
  "modul-evidence-smluv": {
    file: "MODUL_EVIDENCE_SMLOUV.md",
    title: "Modul Evidence smluv",
  },
  "manual-vyroba": {
    file: "MANUAL_VYROBA.md",
    title: "Výroba – uživatelský manuál",
  },
  "dokumentace-kompletni-vyrobaceniny": {
    file: "DOKUMENTACE_KOMPLETNI_vyrobaceniny.md",
    title: "Výroba – kompletní dokumentace",
  },
  "navrh-modul-vyroba": {
    file: "NAVRH_MODUL_VYROBA.md",
    title: "Výroba – návrh modulu",
  },
  "vyroba-tisk": {
    file: "VYROBA_TISK.md",
    title: "Výroba – řešení tisku",
  },
  "modul-iml": {
    file: "MODUL_IML.md",
    title: "Modul IML – dokumentace",
  },
  "iml-newsec": {
    file: "IML_NEWSEC_IMPLEMENTATION.md",
    title: "IML – implementační plán (newsec)",
  },
  "modul-materialy": {
    file: "MODUL_MATERIALY.md",
    title: "Katalog materiálů – dokumentace",
  },
  "auth-sprava-hesel": {
    file: "AUTH_SPRAVA_HESEL.md",
    title: "Správa hesel a 2FA",
  },
};

export function resolveHelpDocSlug(slug: string) {
  return HELP_DOC_SLUGS[slug] ?? null;
}

export function listHelpDocSlugs() {
  return Object.entries(HELP_DOC_SLUGS).map(([slug, meta]) => ({
    slug,
    ...meta,
  }));
}
