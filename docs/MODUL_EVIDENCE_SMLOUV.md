# Modul Evidence smluv – návrh a plán implementace

Dokument shrnuje zadání, architektonické rozhodnutí a **navrhované kroky implementace** modulu evidence smluv v aplikaci INTEGRAF (Next.js, Prisma/MySQL). Podrobný funkcionální seznam požadavků je v kořeni repozitáře v souboru `Evidence_smluv.md`.

---

## Cíl modulu

Centrální evidence smluv s **vícekrokovým schvalováním** (stejný princip jako u kalendáře), **šablonami kroků podle typu smlouvy** a možností, aby u některých typů stačila **nižší instance** schválení a u jiných bylo nutné **nejvyšší vedení**. Dále přílohy, audit, notifikace, vyhledávání, hlídání termínů a napojení na stávající infrastrukturu (`users`, `roles`, `notifications`, `audit_log`, `file_uploads`).

---

## Tok workflow (cílový stav)

Základní posloupnost ze zadání:

**návrh → schválení → podpis → archivace**

### Stavy na hlavičce smlouvy (návrh)

| Stav (příklad) | Popis |
|----------------|--------|
| `draft` | Návrh – rozpracováno, lze editovat |
| `in_approval` | Probíhá vícekrokové schvalování |
| `approval_completed` | Všichni schvalovatelé ze šablony schválili |
| `signature_pending` | Čeká na záznam podpisu |
| `signed` | Podpis zaznamenán |
| `archived` | Archivováno |
| `rejected` | Zamítnuto |
| `returned` | Volitelně: vráceno k přepracování (místo tvrdého zamítnutí) |

Přesné názvy konstant sjednotit v kódu (enum / string) před Fází 1.

---

## Vícekrokové schvalování (stejně jako kalendář)

Inspirace existujícím modulem:

- **`calendar_events`** – agregovaný stav (`approval_status`)
- **`calendar_approvals`** – jeden řádek na krok: `approver_id`, `approval_order`, `approval_type`, `status`, `comment`, `approved_at`

U smluv analogicky:

- **`contracts`** – pole `approval_status` (nebo `workflow_status`) pro souhrn
- **`contract_approvals`** – konkrétní kroky; aktivní je řádek s `status = pending` a nejmenším `approval_order` (stejná logika jako u schvalování událostí)

Po schválení kroku se buď **vytvoří další řádek** pro dalšího schvalovatele (postup jako u kalendáře po zástupovi → vedoucí), nebo se uzavře celé schvalování a nastaví se `approval_completed`.

---

## Šablona podle typu smlouvy

Typ smlouvy určuje **počet a druh kroků**, ne jednu globální politiku pro všechny smlouvy.

### Číselníky / šablony

- **`contract_types`** – např. dodavatelská, strategická, pracovní…
- **`contract_workflow_steps`** – šablona (ne konkrétní smlouva):
  - `contract_type_id`
  - `step_order` (1, 2, 3…)
  - **`resolver`** – jak určit uživatele-schvalovatele v okamžiku odeslání návrhu ke schválení

### Příklady resolverů (pravidla přiřazení)

| Resolver | Chování (příklad) |
|----------|-------------------|
| `department_manager` | `departments.manager_id` pro oddělení navázané na smlouvu / žadatele (obdoba logiky kalendáře) |
| `legal_counsel` | Uživatel nebo role z nastavení / číselníku |
| `financial_approval` | Oprávněná osoba z nastavení |
| `executive` / `ceo` | Nejvyšší vedení – konkrétní uživatel nebo záznam v interní tabulce / `system_settings` |
| `fixed_user` | Pevné `user_id` v řádku šablony |

**Nižší instance vs nejvyšší vedení:** řeší se kombinací **šablony** (jeden typ = jeden krok jen vedoucí; jiný typ = více kroků s posledním krokem `executive`) a **resolveru** u každého kroku.

### Odeslání ke schválení

1. Načíst `contract_workflow_steps` pro `contract_type_id` smlouvy, seřadit podle `step_order`.
2. Pro první krok vyřešit `approver_id` podle `resolver` (a kontextu: oddělení, žadatel, nastavení firmy).
3. Vytvořit první záznam v `contract_approvals`, nastavit `contracts.approval_status = in_approval`, odeslat notifikaci.

Pokud nelze určit schvalovatele (např. chybí `manager_id`), API vrátí chybu a smlouva zůstane v návrhu.

---

## Datový model (návrh)

Minimální sada tabulek pro MVP workflow:

| Tabulka | Účel |
|---------|------|
| `contract_types` | Číselník typů smluv |
| `contract_workflow_steps` | Šablona kroků: typ, pořadí, resolver, volitelně `fixed_user_id` |
| `contracts` | Hlavička smlouvy (název, číslo, strany, typ, popis, datumy, hodnota, odpovědná osoba, FK na typ, stav workflow, `created_by`, vazba na oddělení pro resolvování, …) |
| `contract_approvals` | Instance schvalování u konkrétní smlouvy (jako `calendar_approvals`) |

Přílohy navázat na stávající **`file_uploads`** (`module`, `record_id`). Historii změn doplňovat do **`audit_log`** (`module = 'contracts'`). Uživatelské upozornění do **`notifications`**.

---

## API

Implementované endpointy viz **Fáze 3** výše. Obecně: přihlášený uživatel; úpravy návrhu jen autor nebo admin; schvaluje jen uživatel s otevřeným `pending` krokem.

| Endpoint | Účel |
|----------|------|
| CRUD `/api/contracts` | Vytvoření, čtení, úprava ve stavech `draft` / `returned` |
| `POST /api/contracts/[id]/submit` | Odeslání z návrhu ke schválení – resolv prvního schvalovatele, první `contract_approvals` |
| `POST /api/contracts/[id]/approve` | `action: approve \| reject`, `comment` u zamítnutí – stejný vzor jako `POST /api/calendar/[id]/approve` |
| `GET /api/contract-types` | Typy smluv a šablony kroků |
| Volitelně později `POST …/return` | Vrácení k úpravě |

---

## Navrhované kroky implementace

### Fáze 0 – Příprava

- Sjednotit názvy stavů workflow a enum/string v kódu.
- Mapovat role z `roles` / `permissions` na akce: návrh, schvalování, podpis, archiv, auditor (read-only).
- Rozhodnout: e-mailové notifikace od začátku, nebo nejdřív jen in-app (`notifications`).

### Fáze 1 – Databáze a Prisma ✅

- Modely v `prisma/schema.prisma`: `contract_types`, `contract_workflow_steps`, `contracts`, `contract_approvals`.
- Vazby na `users` (autor, odpovědná osoba, `fixed_user` ve šabloně), `departments`, `contract_types`.
- SQL pro ruční spuštění v MySQL: `prisma/migrations/20260327_add_contracts_module.sql`
- Konstanty `contracts.approval_status`: `lib/contracts/workflow-status.ts`
- Po změně schématu: `prisma generate` (projekt spouští `postinstall`).

### Fáze 2 – Resolvování schvalovatelů ✅

- `lib/contracts/resolver-keys.ts` – konstanty `ContractResolver`, klíče `CONTRACT_SYSTEM_SETTING_KEYS` pro `system_settings`.
- `lib/contracts/resolveApprovers.ts` – `resolveDepartmentIdForContract`, `resolveApproverForWorkflowStep` (vrací `{ ok, userId }` nebo `{ ok: false, message }`).
- **Resolvery:** `department_manager` (vedoucí z `departments.manager_id`, oddělení ze smlouvy nebo autora), `legal_counsel`, `financial_approval`, `executive` (alias `ceo` – stejné jako executive), `fixed_user` (`fixed_user_id` ve šabloně). Aliasy: `legal` → legal_counsel, `financial`/`finance` → financial_approval.
- **Nastavení (volitelná, pro právní / finance / vedení):** v tabulce `system_settings` hodnota = ID uživatele (text): `contracts_resolver_legal_user_id`, `contracts_resolver_financial_user_id`, `contracts_resolver_executive_user_id`.

### Fáze 3 – API (jádro workflow) ✅

- **GET/POST** `/api/contracts` – seznam (query `approval_status`, `contract_type_id`, `limit`), vytvoření návrhu.
- **GET/PUT/DELETE** `/api/contracts/[id]` – detail, úprava (jen `draft` / `returned`, autor nebo admin), smazání za stejných podmínek.
- **POST** `/api/contracts/[id]/submit` – odeslání ke schválení (vymaže staré `contract_approvals` při opakovaném odeslání).
- **POST** `/api/contracts/[id]/approve` – tělo `{ action: "approve" | "reject", comment? }` (důvod povinný u zamítnutí); jen aktuální `pending` schvalovatel.
- **GET** `/api/contract-types` – aktivní typy včetně kroků šablony (pro formuláře).
- Audit: `lib/contracts/audit.ts` → `audit_log` (modul `contracts`). Notifikace: typy `contract_approval`, `contract_rejected`, `contract_approved`.

### Fáze 4 – UI ✅

- **`/contracts`** – seznam s filtry (stav, typ), odkaz na novou smlouvu.
- **`/contracts/new`** – formulář vytvoření (`ContractForm`).
- **`/contracts/[id]`** – detail, údaje, historie schvalování, akce Odeslat / Schválit / Zamítnout (`ContractApprovalPanel`), smazání návrhu.
- **`/contracts/[id]/edit`** – úprava jen ve stavech návrh / vráceno (shodně s API).
- **Menu:** položka „Evidence smluv“ v postranním panelu (`components/layout/Sidebar.tsx`).
- Pomocné: `lib/contracts/status-labels.ts` (české popisky stavů).

### Fáze 5 – Podpis a archivace ✅

- Přechody: `approval_completed` → `signature_pending` → `signed` → `archived` (`POST /api/contracts/[id]/transition`: `begin_signature`, `sign`, `archive`).
- Oprávnění: autor, `responsible_user_id`, administrátor (`lib/contracts/access.ts`).
- **Přílohy:** `file_uploads` s `module = 'contracts'`, `record_id = contracts.id` (sloupec `record_id` v DB – migrace `prisma/migrations/20260327_file_uploads_record_id.sql`).
- API: `GET/POST /api/contracts/[id]/files`, `DELETE /api/contracts/[id]/files/[fileId]` (PDF, Office, obrázky, max 20 MB → `public/uploads/contracts/`).
- UI: `ContractLifecyclePanel`, `ContractAttachments` na detailu smlouvy.

### Fáze 6 – Přílohy a náhled ✅

- Více souborů na smlouvu (již dříve).
- **Náhled PDF** v detailu smlouvy: tlačítko Náhled / Skrýt u přílohy `application/pdf` → vložený `iframe` (`ContractAttachments`).

### Fáze 7 – Vyhledávání, termíny, reporty ✅

- **Vyhledávání:** `q` v URL a formulářem na `/contracts`; `buildContractsWhere` + `parseContractListSearchParams` (`lib/contracts/list-where.ts`) – pole názvu, číslo, strany, popis.
- **Filtry:** stav, typ, **končí do 30 / 60 / 90 dnů** (platnost `valid_until` nebo `expires_at`).
- **Export CSV:** `GET /api/contracts/export` (stejné query jako seznam, UTF-8 s BOM, středník).
- **Dashboard:** upozornění na „moje“ smlouvy končící do 90 dnů (autor / odpovědná osoba).
- **Cron notifikace:** `POST /api/cron/contracts-expiry` s `Authorization: Bearer <CRON_SECRET>`; volitelně `?days=90`. Proměnná `CRON_SECRET` v `.env`. Logika v `lib/contracts/expiry-reminders.ts` (deduplikace 7 dní, typ `contract_expiry`).

### Fáze 8 – Administrace číselníků

- UI pro typy smluv a **šablony kroků** (pořadí, resolver, volitelně pevný uživatel).
- Správa dodavatelů/odběratelů (pokud budou samostatné entity).

### Fáze 9 – Integrace a tvrdší požadavky

- Veřejné nebo interní API pro ERP (autentizace, oprávnění).
- Export/import dávek.
- Microsoft Entra ID – rozšíření NextAuth vedle stávajícího přihlášení (role v DB beze změny workflow logiky).

### Fáze 10 – Volitelné rozšíření

- OCR, DMS, e-podpis, šablony Word/PDF, prodloužení smlouvy jedním klikem.

**Doporučené MVP:** Fáze **1 → 2 → 3 → 4** (plnohodnotný tok návrh → vícekrokové schválení podle typu), poté **5**, pak **8** (úprava šablon bez zásahu vývojáře).

---

## Fáze 1 – detail implementace

### `contract_types`

Číselník typů smluv: `name`, volitelně unikátní `code`, `description`, `sort_order`, `is_active`, časová razítka.

### `contract_workflow_steps`

Šablona kroků pro daný typ: `step_order` (unikátní v kombinaci s `contract_type_id`), `resolver` (např. `department_manager`, `fixed_user`), volitelně `fixed_user_id` → `users`.

### `contracts`

Hlavička: `title`, `contract_number`, strany (`party_company`, `party_contact`), `contract_type_id`, `description`, **`approval_status`** (výchozí `draft`), hodnota (`value_amount`, `value_currency`), datumy (`effective_from`, `valid_until`, `expires_at`, `signed_at`), `created_by`, `responsible_user_id`, `department_id` (pro resolvování schvalovatele).

### `contract_approvals`

Jako u kalendáře: `approver_id`, `approval_order`, `approval_type`, `status` (`pending` / …), `comment`, `approved_at`.

### Nasazení databáze

- Doporučený postup: spustit **`prisma/migrations/20260327_add_contracts_module.sql`** v MySQL (bez zásahu do ostatních tabulek).
- Alternativa: `npx prisma db push` – na některých instalacích může Prisma hlásit varování kvůli **nesouladu jiných tabulek** se schématem (např. enum); v takovém případě nepoužívejte `--accept-data-loss` bez kontroly – raději SQL skript výše.

---

## Odkazy v repozitáři

- Zadání funkcí: `Evidence_smluv.md`
- Vzor vícefázového schvalování (kalendář): `docs/MODUL_KALENDAR.md`, `docs/KALENDAR_SCHVALOVANI_FAZE2.md`
- Schvalovací API kalendáře: `app/api/calendar/[id]/approve/route.ts`
- Moduly: `prisma/schema.prisma` – sekce Evidence smluv; `lib/contracts/workflow-status.ts`, `lib/contracts/resolveApprovers.ts`, `lib/contracts/resolver-keys.ts`
- Dříve obecné modely: `audit_log`, `notifications`, `file_uploads`

---

## Verze dokumentu

- **2026-03** – první verze (návrh architektury a plán fází).
- **2026-03-27** – Fáze 1: Prisma modely, SQL migrace, konstanty stavů (`lib/contracts/workflow-status.ts`).
- **2026-03-27** – Fáze 2: `lib/contracts/resolveApprovers.ts`, `resolver-keys.ts`, dokumentace klíčů `system_settings`.
- **2026-03-27** – Fáze 3: REST API pod `app/api/contracts/`, `app/api/contract-types/`, pomocné moduly `lib/contracts/audit.ts`, `parse-payload.ts`, `workflow-helpers.ts`.
- **2026-03-27** – Fáze 4: UI `app/(dashboard)/contracts/` (seznam, nová, detail, úprava), sidebar, `status-labels.ts`.
- **2026-03-27** – Fáze 5: `file_uploads.record_id`, API transition + přílohy, `ContractLifecyclePanel`, `ContractAttachments`, `lib/contracts/access.ts`.
- **2026-03-27** – Fáze 6: náhled PDF v `ContractAttachments` (iframe).
- **2026-03-27** – Fáze 7: `list-where.ts`, `expiry-reminders.ts`, export CSV, cron, úpravy `/contracts` a dashboardu.
