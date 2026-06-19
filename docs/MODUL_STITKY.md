# Modul Štítky výroba (`stitky`) – dokumentace

Modul slouží k zadávání, schvalování a tisku výrobních štítků — přepis Excel makro souboru `A17984_Standard_hotovo.xlsm` do webové aplikace INTEGRAF. PDF a náhled se ukládají v aplikaci (DB), nikoli na síťový disk.

Detailní technická specifikace z reverzní analýzy XLSM: [Stitky_Vyroba/AGENT_SPEC.md](./Stitky_Vyroba/AGENT_SPEC.md).

---

## Přehled stránek

| Funkce | Cesta | Popis |
|--------|-------|-------|
| Moje zakázky | `/stitky` | Zakázky zadané aktuálním uživatelem + souhrnné karty stavů |
| Ke zpracování | `/stitky/fronta` | Fronta pro tiskaře/mistry (SUBMITTED, SUBMITTED_MISTRI, PRINTED) |
| Všechny zakázky | `/stitky/vse` | Admin modulu — všechny zakázky v systému |
| Nová zakázka | `/stitky/new` | Formulář zadání (max 5 řádků štítků) |
| Detail zakázky | `/stitky/[id]` | Úprava, zadání do výroby, tisk |
| Náhled / tisk řádku | `/stitky/[id]/preview/[row]` | HTML mřížka na A4 + tisk prohlížeče |
| Nastavení modulu | `/stitky/settings` | Dodatečné e-mailové adresy (hlavní příjemci = role v adminu) |
| Správa rolí | `/admin/users` | Úroveň modulu + příznaky Tiskař / Mistr |

Navigace záložek: `StitkyTabsNav` v layoutu modulu. Viditelnost záložek dle role (`lib/stitky/list-access.ts`).

---

## Přehledy podle role

| Role | Výchozí záložka | Co vidí |
|------|-----------------|---------|
| Zadavatel | Moje zakázky | Pouze `created_by = já`, karty stavů, filtr klikem na kartu |
| Tiskař / Mistr | Ke zpracování | Fronta zakázek čekajících na tisk nebo potvrzení |
| Admin modulu | Všechny + Nastavení | Kompletní přehled bez filtru zadavatele |

---

## In-app notifikace

| Typ | Kdy | Příjemce |
|-----|-----|----------|
| `stitky_submitted` | Zadání pro mailing | Uživatelé s rolí **Tiskař** + **Admin modulu** (z administrace) |
| `stitky_submitted_mistri` | Zadání pro mistry | Uživatelé s rolí **Mistr** |
| `stitky_printed` | První PDF / tisk | Zadavatel zakázky (`created_by`) |
| `stitky_done` | Zpracováno | Zadavatel zakázky (`created_by`) |

Implementace: `lib/stitky-notify.ts`, příjemci rolí: `lib/stitky/recipients.ts`.

Příjemce se **nekonfigurují zvlášť** — odvozují se z rolí v administraci uživatelů (`stitky_tiskar`, `stitky_mistr`, `stitky: admin`). Tabulka `stitky_user_roles` se synchronizuje při uložení uživatele; jako záloha se čte i `module_access`.

---

## E-maily

Vyžaduje zapnuté SMTP v administraci aplikace.

| Událost | Příjemci e-mailu |
|---------|------------------|
| Zadání pro mailing | E-maily uživatelů s rolí Tiskař + Admin modulu + **dodatečné adresy** z nastavení |
| Zadání pro mistry | Bez e-mailu (pouze in-app mistrům) |
| Zpracováno | Stejný seznam jako u mailingu (tiskaři/admin + dodatečné) |

V `/stitky/settings` zůstávají jen **dodatečné e-mailové adresy** (např. externí tiskárna bez účtu v IGIS). Klíč v DB: `stitky_settings.email_recipients`.

---

## Role a oprávnění

Oprávnění se nastavují ve **správě uživatelů** (stejný vzor jako u Maket). Klíč modulu: `stitky`.

| Profil | Nastavení v admin UI | `module_access` | Co umožňuje |
|--------|----------------------|-----------------|-------------|
| **Prohlížeč** | Úroveň *Prohlížení* | `{ "stitky": "read" }` | Přehled a detail zakázek |
| **Zadavatel** | Úroveň *Zadavatel* | `{ "stitky": "write" }` | Vytváření a úprava zakázek, zadání do výroby |
| **Tiskař** | Prohlížení + ✓ Tiskař | `{ "stitky": "read", "stitky_tiskar": "1" }` | Náhled, PDF, tisk, označení *Zpracováno* |
| **Mistr** | Prohlížení + ✓ Mistr | `{ "stitky": "read", "stitky_mistr": "1" }` | Totéž co tiskař |
| **Admin modulu** | Úroveň *Admin* | `{ "stitky": "admin" }` | Nastavení e-mailů, plný přístup |

Globální role **Admin** má přístup ke všem funkcím modulu.

Při uložení uživatele se role synchronizují do tabulky `stitky_user_roles` (záložní zdroj pro audit).

---

## Workflow zakázky

| Stav | Popis | Akce |
|------|-------|------|
| `DRAFT` | Rozpracované | Uložit, upravit |
| `SUBMITTED` | Zadáno pro mailing | E-mail tiskárně; zadavatel vidí stav v *Moje zakázky*; tlačítka zadání zmizí |
| `SUBMITTED_MISTRI` | Zadáno pro mistry | Bez e-mailu; jinak stejné jako SUBMITTED |
| `PRINTED` | Vytištěno | Po prvním PDF/tisku; zadavatel dostane notifikaci `stitky_printed` |
| `DONE` | Hotovo | Tiskař klikne *Zpracováno* → e-mail + notifikace `stitky_done` zadavateli |

Validace při zadání odpovídá VBA proceduře `S_800_Kontrola_zadani` (`lib/stitky/validators/order.ts`).

Generování číselné řady odpovídá `S_900_Ciselna_rada` (`lib/stitky/ciselna-rada.ts`).

### Mazání zakázek

Tlačítko **Smazat zakázku** je na detailu (`/stitky/[id]`). Řádky štítků se smažou kaskádou z DB.

| Kdo | Co smí smazat |
|-----|----------------|
| **Zadavatel** (vlastník) | Jen vlastní zakázku ve stavu `DRAFT` |
| **Admin modulu štítků** | Libovolnou zakázku ve stavu `DRAFT`, `SUBMITTED`, `SUBMITTED_MISTRI`, `PRINTED` |
| **Nikdo** | Zakázky ve stavu `DONE` |

Logika: `canDeleteStitkyOrder` v `lib/stitky/access.ts`. Audit: akce `DELETED` v `audit_log`.

---

## Šablony štítků

Šablony jsou v tabulce `stitky_templates`. Stav `layout_status`:

- **`ready`** — plně implementovaný layout (náhled, PDF, tisk)
- **`pending_layout`** — historický stav; po migraci `20260619130000_stitky_templates_standard_fallback` se nepoužívá

### Připravené šablony (ready)

| Klíč | Layout | Poznámka |
|------|--------|----------|
| Standard | `standard` | 2×7 na A4, 95×38 mm |
| Standard IG | `standard` | Stejný layout jako Standard |
| Neutrální | `neut` | Stejná mřížka, jiné popisky |
| Oriflame | `oriflame` | 2×5, CODE128 přes `bwip-js` |

### Šablony s layoutem Standard (dočasně)

MHA, DPMB (4 varianty), DP Bratislava, Obálky SVK/CZ, Billa, Jídelní kupóny, Korid LK, jiné — mají `layout_status = ready` a `component_key = standard`. Lze zadat do výroby, tisknout a generovat PDF; vizuál odpovídá šabloně **Standard** (mřížka 2×7), ne originálnímu Excelu.

Vlastní layouty (MHA, DPMB, Obálky…) lze doplnit později z referenčního XLSM — nový `component_key` a renderer v `lib/stitky/pdf-labels.ts`.

---

## Databázové tabulky

| Tabulka | Popis |
|---------|-------|
| `stitky_orders` | Zakázka (číslo, šablona, stav, poznámky) |
| `stitky_label_rows` | Řádky štítků (množství, balení, texty, číselná řada) |
| `stitky_templates` | Katalog šablon a parametry mřížky |
| `stitky_user_roles` | Sync rolí ze správy uživatelů |
| `stitky_settings` | Klíč `email_recipients` — středníkem oddělené adresy |

Migrace: `npm run db:stitky-migrate` (soubory v `prisma/migrations/20260619120000_stitky_module/` a `20260619130000_stitky_templates_standard_fallback/`).

---

## API

| Metoda | Cesta | Popis |
|--------|-------|-------|
| GET | `/api/stitky/orders` | Seznam zakázek |
| POST | `/api/stitky/orders` | Nová zakázka |
| GET/PATCH | `/api/stitky/orders/[id]` | Detail / úprava |
| DELETE | `/api/stitky/orders/[id]` | Smazání zakázky |
| POST | `/api/stitky/orders/[id]/submit` | Zadání pro mailing |
| POST | `/api/stitky/orders/[id]/submit-mistri` | Zadání pro mistry |
| GET | `/api/stitky/orders/[id]/preview/[row]` | JSON náhled řádku |
| GET | `/api/stitky/orders/[id]/pdf/[row]` | Stažení PDF |
| POST | `/api/stitky/orders/[id]/print/[row]` | Audit tisku |
| POST | `/api/stitky/orders/[id]/complete` | Stav DONE + e-mail |
| GET | `/api/stitky/templates` | Seznam šablon |
| GET/PATCH | `/api/stitky/settings` | Dodatečné e-mailové adresy |
| GET | `/api/stitky/barcode?text=…` | PNG CODE128 (Oriflame) |

Audit akcí modulu se zapisuje do `audit_log` (`module = stitky`).

---

## Rychlý start

1. Spusťte migraci: `npm run db:stitky-migrate`
2. V **Admin → Uživatelé** přiřaďte modul *Štítky výroba* a role (viz tabulka výše)
3. V adminu přiřaďte role Tiskař/Mistr; volitelně doplňte externí e-maily v `/stitky/settings`
4. Zadavatel vytvoří zakázku na `/stitky/new`, vyplní řádky a odešle do výroby
5. Tiskař otevře náhled, vytiskne nebo stáhne PDF, označí *Zpracováno*

---

## Technologie

- Next.js 16 App Router, Prisma 7, MariaDB
- PDF: `pdf-lib` + DejaVu fonty (`lib/vyroba/protocol/fonts`)
- Čárový kód: `bwip-js/node` (CODE128)
- Unit testy: `lib/stitky/ciselna-rada.test.ts`, `lib/stitky-module-access-flags.test.ts`
