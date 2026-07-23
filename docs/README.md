# Dokumentace – INTEGRAF Next.js

Přehled dokumentace modulů a specifikací projektu.

## Uživatelské manuály

| Dokument | Popis |
|----------|-------|
| [MANUAL_MODULY_HOTOVE.md](MANUAL_MODULY_HOTOVE.md) | Stručný manuál hotových modulů (zaškolení) |
| [KALENDAR_NAVOD_UZIVATEL.md](KALENDAR_NAVOD_UZIVATEL.md) | Kalendář – návod pro uživatele |
| [MANUAL_VYROBA.md](MANUAL_VYROBA.md) | Výroba – uživatelský manuál |

## Moduly – technická dokumentace

| Dokument | Popis |
|----------|-------|
| [MODUL_KALENDAR.md](MODUL_KALENDAR.md) | Kalendář – zobrazení, CRUD, schvalování, opakování, připomínky, soukromé události, export .ics |
| [MODUL_UKOLY.md](MODUL_UKOLY.md) | Úkoly – zadání, notifikace, archiv, export |
| [MODUL_MAJETEK_POZADAVKY.md](MODUL_MAJETEK_POZADAVKY.md) | Majetek – schvalování požadavků na techniku (IT → Vedení) |
| [MODUL_MAJETEK_QR.md](MODUL_MAJETEK_QR.md) | Majetek – plán evidence drobného majetku s QR, místnostmi a inventurou |
| [MODUL_EVIDENCE_SMLOUV.md](MODUL_EVIDENCE_SMLOUV.md) | Evidence smluv – workflow, přílohy, export, upozornění na platnost |
| [MODUL_MATERIALY.md](MODUL_MATERIALY.md) | Katalog materiálů – SDS/TDS/certifikáty, kategorie, vazba na IML |
| [KALENDAR_SCHVALOVANI_FAZE2.md](KALENDAR_SCHVALOVANI_FAZE2.md) | Specifikace dvoufázového schvalování kalendáře |
| [AUTH_SPRAVA_HESEL.md](AUTH_SPRAVA_HESEL.md) | Obnova hesla, aktivace, politika, **2FA (TOTP)** |
| [ADMIN_ZALOHA.md](ADMIN_ZALOHA.md) | Záloha a obnova dat modulů (administrátor) |

## Modul IML

| Dokument | Popis |
|----------|-------|
| [MODUL_IML.md](MODUL_IML.md) | Kompletní dokumentace – zákazníci, produkty, poptávky, objednávky, reporty |
| [iml_newsec.md](iml_newsec.md) | Technická specifikace rozšíření IML |
| [IML_NEWSEC_IMPLEMENTATION.md](IML_NEWSEC_IMPLEMENTATION.md) | Implementační plán a checklist fází 1–7 |

## Modul Výroba

| Dokument | Popis |
|----------|-------|
| [NAVRH_MODUL_VYROBA.md](NAVRH_MODUL_VYROBA.md) | Návrh modulu – architektura, fáze (hotovo) |
| [DOKUMENTACE_KOMPLETNI_vyrobaceniny.md](DOKUMENTACE_KOMPLETNI_vyrobaceniny.md) | Kompletní dokumentace IG52 |
| [MANUAL_VYROBA.md](MANUAL_VYROBA.md) | Uživatelský manuál |
| [VYROBA_TISK.md](VYROBA_TISK.md) | Řešení tisku PDF/TXT |

## Migrace a nasazení

| Dokument | Popis |
|----------|-------|
| [../migrations/planovani-igvyroba/README.md](../migrations/planovani-igvyroba/README.md) | Migrace dat plánování z igvyroba |
| [../nasazeni.md](../nasazeni.md) | Nasazení na server, ruční SQL migrace |
| [../git.md](../git.md) | Git workflow, test server, klon DB |

## Struktura

| Složka | Obsah |
|--------|-------|
| `docs/` | Dokumentace modulů |
| `migrations/*/README.md` | Migrační skripty |
| `MIGRACE_NEXTJS.md` (kořen) | Plán migrace PHP → Next.js |

V aplikaci: nápověda `?` v hlavičce, detailní markdown na `/help/{slug}` (viz `lib/help/doc-slugs.ts`).
