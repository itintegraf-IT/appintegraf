# Dokumentace – INTEGRAF Next.js

Přehled dokumentace modulů a specifikací projektu.

## Moduly

| Dokument | Popis |
|----------|-------|
| [MODUL_KALENDAR.md](MODUL_KALENDAR.md) | Kalendář – týdenní/měsíční zobrazení, CRUD událostí, filtry (Globální/Osobní), drag & drop, dvoufázové schvalování, export .ics |
| [MODUL_UKOLY.md](MODUL_UKOLY.md) | Úkoly – zadání/úpravy, role, notifikace, kalendářová linka podle stavu, archiv a export CSV/XLSX |
| [MODUL_MAJETEK_POZADAVKY.md](MODUL_MAJETEK_POZADAVKY.md) | Majetek – dvoufázové schvalování požadavků na techniku (IT → Vedení), stavy, datový model a API |
| [KALENDAR_SCHVALOVANI_FAZE2.md](KALENDAR_SCHVALOVANI_FAZE2.md) | Specifikace dvoufázového schvalování (zástup → vedoucí oddělení) |
| [AUTH_SPRAVA_HESEL.md](AUTH_SPRAVA_HESEL.md) | Obnova hesla, aktivační odkazy, politika, audit, invalidace sessionů |

## Modul IML

| Dokument | Popis |
|----------|-------|
| [MODUL_IML.md](MODUL_IML.md) | Kompletní dokumentace modulu IML – přehled, databáze, API, export/import, vlastní pole, fáze implementace |
| [iml_newsec.md](iml_newsec.md) | Technická specifikace rozšíření IML (zákazníci, produkty, poptávky, objednávky, Pantone, reporty) |
| [IML_NEWSEC_IMPLEMENTATION.md](IML_NEWSEC_IMPLEMENTATION.md) | **Implementační plán** rozšíření IML dle `iml_newsec.md` – odškrtávací checklist fází 1–7 |

## Modul Výroba

| Dokument | Popis |
|----------|-------|
| [NAVRH_MODUL_VYROBA.md](NAVRH_MODUL_VYROBA.md) | Návrh a plán implementace – architektura, datový model, fáze 1–6, **stav implementace (všechny fáze hotové)** |
| [DOKUMENTACE_KOMPLETNI_vyrobaceniny.md](DOKUMENTACE_KOMPLETNI_vyrobaceniny.md) | Kompletní dokumentace IG52 – výpočty, formáty, migrace do Next.js |
| [MANUAL_VYROBA.md](MANUAL_VYROBA.md) | **Uživatelský manuál** – přehled obrazovek, tok práce, řešení problémů |
| [VYROBA_TISK.md](VYROBA_TISK.md) | **Řešení tisku** – PDF, TXT, možnosti nasazení |

## Migrace

| Dokument | Popis |
|----------|-------|
| [../migrations/planovani-igvyroba/README.md](../migrations/planovani-igvyroba/README.md) | Migrace dat z igvyroba do appintegraf (modul Plánování) |

## Struktura dokumentace

| Složka | Obsah |
|--------|-------|
| `docs/` | Dokumentace modulů a specifikace |
| `migrations/*/README.md` | Migrační skripty a jejich popis |
| `MIGRACE_NEXTJS.md` – v kořeni projektu | Plán migrace z PHP na Next.js |
