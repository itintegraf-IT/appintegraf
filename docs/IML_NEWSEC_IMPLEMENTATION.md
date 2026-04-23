# IML – Implementační plán (dle iml_newsec.md)

> Referenční specifikace: [`iml_newsec.md`](./iml_newsec.md)  
> Základní dokumentace modulu: [`MODUL_IML.md`](./MODUL_IML.md)  
> Status: **připraveno k implementaci**

Tento dokument je závazný postup implementace. Každá fáze je samostatně nasaditelná a má vlastní akceptační kritéria (checklist). Odškrtávejte boxy průběžně tak, jak agent dokončí jednotlivé úkoly.

---

## Globální checklist fází

Každá fáze má stavy: `dev` → `test` (pushnuto + deploy na test server) → `prod` (součást produkčního balíku).

- [x] **Fáze 1** – Datový model + migrace *(2026-04-22, commits `a216107` + `0175a86`, deployed na test)*
- [x] **Fáze 2** – Zákazníci: multi-shipping + strukturovaná fakturace *(hotovo na test serveru + validace vstupů F2.7)*
- [ ] **Fáze 3** – Produkty: taby, Fólie, Pantone, verzování PDF, nové stavy
- [ ] **Fáze 4** – Modul Poptávky (Inquiries) + konverze
- [ ] **Fáze 5** – Objednávky: Smart UI, snapshot adresy, validace, XML export
- [ ] **Fáze 6** – Reporting: Četnost barev a plánovaná spotřeba
- [ ] **Fáze 7** – Úklid (odstranění legacy sloupců, dokumentace)

### Produkční balíky (strategie nasazení – viz § 0.4)

- [ ] **Balík A (F1 + F2 + F3)** – Zákazníci a produkty v novém *(čeká na dokončení F3)*
- [ ] **Balík B (F4 + F5)** – Poptávky a objednávky
- [ ] **Balík C (F6 + F7)** – Reporting a cleanup

---

## 0. Výchozí stav a konvence

Framework: **Next.js App Router + TypeScript + Prisma (MySQL) + NextAuth**.

### 0.1 Co již existuje v repu

Databáze (`prisma/schema.prisma`):
- `iml_customers` – plochý model, adresy jako `Text`.
- `iml_products` – `image_data`, `pdf_data` jako `LongBlob` přímo v řádku.
- `iml_orders` + `iml_order_items`.
- `iml_custom_fields` – dynamická pole pro `products` / `orders`.

API (`app/api/iml/**`):
- `customers`, `customers/[id]`, `customers/import`, `customers/export`
- `products`, `products/[id]`, `products/[id]/image`, `products/[id]/pdf`, `products/import`, `products/export`
- `orders`, `orders/[id]`, `orders/import`, `orders/export`
- `custom-fields`, `custom-fields/[id]`

UI (`app/(dashboard)/iml/**`):
- `page.tsx`, `customers/*`, `products/*`, `orders/*`, `settings/*`, `imports/page.tsx`
- Sdílené: `_components/CustomFieldsFormSection.tsx`, `products/_components/ProductFilesUpload*.tsx`

Utility: `lib/iml-audit.ts`, `lib/iml-export.ts`, `lib/auth-utils.ts`, `lib/db.ts`.

### 0.2 Konvence (závazné pro všechny fáze)

- [ ] Auth gate na všech route handlerech (`auth()` + `hasModuleAccess`)
- [ ] Audit přes `logImlAudit` u každého create/update/delete
- [ ] Validace vstupu ve stylu `parseProductBody` (helpery `str/int/num`)
- [ ] TailwindCSS, primární červený button (`bg-red-600`), karty `rounded-xl border bg-white shadow-sm`
- [ ] Explicitní MySQL datové typy v Prisma (`@db.VarChar(N)`, `@db.DateTime(0)`, `@db.Decimal(p,s)`)
- [ ] Jedna migrace / fáze, název `iml_newsec_phaseN_<krátký_popis>`
- [ ] `prisma generate` po každé úpravě schématu
- [ ] Legacy sloupce **nemazat** v první iteraci, úklid až ve Fázi 7
- [ ] Žádné `any`, preferovat typy z `@prisma/client`

---

## 0.3 Dopad na ostatní moduly a izolační strategie

> **Cíl:** rozšíření IML nesmí rozbít, zpomalit ani změnit chování ostatních modulů (Kalendář, Úkoly, Majetek, Plánování výroby, Výroba, Kontakty, Tests/Questions, AUTH). Tato sekce enumeruje všechny sdílené body a pravidla pro jejich bezpečnou modifikaci.

### 0.3.1 Mapa sdílených entit

| Sdílená entita / prvek | Sdílí s moduly | Charakter sdílení | Rizika při rozšíření IML |
|---|---|---|---|
| `audit_log` (Prisma model) | VŠECHNY | přes `module` + `table_name` + `record_id (Int)` | Nové `table_name` je aditivní, žádné riziko. `record_id` musí být `Int` – platí pro všechny nové IML tabulky. |
| `users` (Prisma model) | VŠECHNY | FK z `iml_product_files.uploaded_by`, `iml_*_created/updated_by`, audit | **Každá** nová FK na `users` vyžaduje back-relaci v modelu `users` (jinak `prisma validate` selže). |
| `roles` / `user_roles.module_access` | Admin, všechny chráněné moduly | JSON `{ "iml": "read|write|admin" }` nebo pole `["iml.view","iml.write"]` | Nové IML akce (`iml.supervisor_override`) **nesmí** měnit parser v `lib/auth-utils.ts`; používat pole-formát, který parser již zná. |
| `file_uploads` (Prisma model) | Kontakty, Úkoly, Smlouvy | dle `module` + `record_id` | IML verzování PDF **nebude** používat `file_uploads` (aby se neduplikovalo); zůstává `iml_product_files`. Pokud by se v budoucnu sjednocovalo, jen přes samostatný PR. |
| `system_settings` | Admin, Equipment, Tests | klíč-hodnota s `module` | Pokud bude IML potřebovat settings (např. default `supervisor_override_required`), použít `module="iml"` – aditivní. |
| `orderNumber` / `cislo_zakazky` v `planovani_blocks`, `vyroba_job_config` | Plánování výroby, Výroba | volný `VARCHAR`, **bez** FK na `iml_orders` | `iml_orders.order_number` držíme `VARCHAR(50)`. Nová objednávka nesmí změnit formát (stále je to uživatelský řetězec, ne UUID). |
| `notifications` | Všechny | `user_id` + `link` | Nové notifikace (např. při překlopení poptávky) posílat výhradně přes stávající model – aditivní. |
| `Sidebar` (`components/layout/Sidebar.tsx`) | UI všech modulů | routing + ikony | Nové položky menu (`iml/inquiries`, `iml/reports/pantone`) **přidat pod stávající scope `"iml"`**, ne jako samostatný modul. |

### 0.3.2 Pravidla izolace (co nesmí žádná fáze udělat)

- ❌ **Neměnit** název, typ ani délku existujících sdílených sloupců (`users.*`, `audit_log.*`, `file_uploads.*`, `system_settings.*`).
- ❌ **Nepřidávat** ne-nullable sloupce do existujících sdílených tabulek bez defaultu.
- ❌ **Nemodifikovat** `lib/auth-utils.ts` logiku parsování `module_access` – pouze přidávat nové kódy akcí do pole a číst je helperem `getModuleAccessItems`.
- ❌ **Nepřepsat** žádný stávající endpoint mimo `/api/iml/**` (ani kvůli refaktoru).
- ❌ **Nepřejmenovat** stávající `iml_*` sloupce v rámci Fází 1–6 (jen přidávat nové). Mazání výhradně ve Fázi 7.
- ❌ **Nezavádět** FK z IML tabulek na `planovani_*` / `vyroba_*` – tyto moduly pracují s `orderNumber` jako volným řetězcem, svázání by znamenalo nekompatibilní migraci.
- ❌ **Nerušit** existující `iml_custom_fields` záznamy (`entity` whitelist pouze rozšířit o `"inquiries"`).

### 0.3.3 Pravidla pro nové FK na `users`

Každá nová IML tabulka s odkazem na uživatele musí:

1. Mít uloženou relaci pojmenovanou unikátně (např. `@relation("iml_product_files_uploader")`).
2. Do modelu `users` přidat zpětnou kolekci (jinak Prisma hlásí `P1012`):
   ```prisma
   iml_product_files_uploaded iml_product_files[] @relation("iml_product_files_uploader")
   ```
3. Použít `onDelete: NoAction` nebo `Restrict` (uživatele nemazat cascade – audit stopa).

### 0.3.4 Pravidla pro supervisor override (Fáze 5)

- [ ] Implementace **NE** přes novou `admin` úroveň v `module_access` (to by dalo superuživatelská práva i na Pantone/Fólie mimo záměr).
- [ ] Implementace přes pole-formát: nový kód `iml.supervisor_override` v `module_access`.
- [ ] Helper `hasImlSupervisorOverride(userId)` = zjednodušený wrapper nad existujícím `getModuleAccessItems(userId)` hledající `"iml.supervisor_override"` nebo `"iml.admin"`.
- [ ] Parser `lib/auth-utils.ts` **neměnit** – stávající pole-formát už podporuje volné kódy akcí.

### 0.3.5 Pravidla pro `audit_log`

- [ ] Akce formátovat jako `create:iml_<tabulka>`, `update:iml_<tabulka>`, `delete:iml_<tabulka>`, `convert:iml_inquiries` (pro překlopení poptávky).
- [ ] `record_id` vždy `Int` (všechny nové modely mají `Int @id @default(autoincrement())`).
- [ ] Blob data (pdf/image) **nikdy** nedávat do `old_values` / `new_values` – `sanitizeForAudit` v `lib/iml-audit.ts` to již řeší, novým sloupcům tuto logiku potvrdit testem.

### 0.3.6 Pravidla pro migrace

- [ ] **Zálohovat DB** před každou migrací (`mysqldump` → `/backups/pre_iml_newsec_phaseN_<date>.sql`).
- [ ] Každá migrace musí mít **idempotentní SQL** (pro opakované spuštění na staging/prod).
- [ ] `prisma migrate dev` pouštět pouze na lokálu. Na produkci použít `prisma migrate deploy`.
- [ ] Po každé migraci spustit **smoke test** modulů Plánování, Výroba, Úkoly, Kalendář, Majetek (minimum: `GET` hlavních listů musí projít 200).

### 0.3.7 Smoke-test matice (provést po každé fázi)

| Modul | Endpoint / stránka | Očekávaný výsledek |
|---|---|---|
| Plánování výroby | `GET /planovani` | 200, seznam bloků |
| Výroba | `GET /vyroba/[job]` | 200, konfigurace joba |
| Úkoly | `GET /ukoly` | 200, seznam úkolů |
| Kalendář | `GET /calendar` | 200, události |
| Majetek | `GET /majetek/pozadavky` | 200 |
| Kontakty | `GET /kontakty` (pokud existuje) | 200 |
| Auth | login + refresh session | funkční |
| IML | `GET /iml`, `/iml/customers`, `/iml/products`, `/iml/orders` | 200 + nové prvky UI |
| Audit | dashboard `audit_log` (admin) | 200, obsahuje nové IML záznamy |

### 0.3.8 Rollback strategie

Pro každou fázi:

1. Před migrací udělat `mysqldump` + snapshot `prisma/schema.prisma` (tag v Git).
2. Připravit **reverzní SQL** (drop nových tabulek, rollback `ALTER`) uložený v `prisma/migrations/<timestamp>_iml_newsec_phaseN/rollback.sql` (mimo Prisma workflow).
3. Pro UI/API změny držet commit-per-fázi, aby šel `git revert` bez side effektů.
4. Data-migration skripty (Fáze 1, Fáze 7) musí mít **dry-run mód** (`--dry-run` CLI flag), který jen reportuje plán, nic nezapisuje.

### 0.3.9 CI / lint / typy

- [ ] Po každé fázi spustit `npm run lint` – **žádné nové** warnings/errors (pre-existující lze ignorovat).
- [ ] Po každé fázi spustit `npx tsc --noEmit` – typy musí projít čistě.
- [ ] Pokud existují jednotkové testy (`vitest`), spustit celou sadu – nesmí vzniknout regrese v non-IML modulech.

---

## 0.4 Strategie produkčního nasazení (balíky)

**Princip:** fáze se vyvíjejí a testují **jednotlivě na test serveru**, ale na produkční prostředí se nasazují **v logických balících** – ne po jedné fázi, ani všechny najednou.

### 0.4.1 Důvody balíkového přístupu

| Kritérium | Po fázích (7×) | Balíkově (3×) | Vše najednou (1×) |
|---|---|---|---|
| Riziko jedné změny | nejnižší | nízké | vysoké |
| Rollback | snadný | středně složitý | složitý |
| Konzistence UX | rozbitá „polo-implementace" | konzistentní po balíku | plně konzistentní |
| Režie (backup, komunikace) | **7×** | **3×** | 1× |
| Hodnota pro uživatele | průběžně | průběžně po balíku | až na konci |

Balíkový přístup je **vyvážený kompromis** – stačí malý počet produkčních deploymentů, ale uživatelé nemusí čekat na kompletní projekt.

### 0.4.2 Definice balíků

| Balík | Obsah | Důvod sdružení |
|---|---|---|
| **A** | Fáze 1 + 2 + 3 | Strukturovaná data (F1 schema, F2 zákazníci, F3 produkty) tvoří základ pro všechny další změny; bez F3 by F2 neměla komplementární UI pro produkty |
| **B** | Fáze 4 + 5 | F5 obsahuje konverzi **poptávka → objednávka**, což je funkce F4; samostatná F4 bez F5 nemá smysl |
| **C** | Fáze 6 + 7 | F7 odstraňuje legacy sloupce, které F6 (reporting) už nepoužívá – kontrolovaný úklid |

### 0.4.3 Proces vydání balíku

Pro každý balík (A, B, C) platí:

1. **Vývojový cyklus:** jednotlivé fáze balíku se commit po commitu přidávají na `test` větev a deployují na test server.
2. **Stabilizační okno:** po dokončení poslední fáze balíku nechat **minimálně 1–2 týdny** reálné užívání na test serveru (uživatel testuje typický workflow).
3. **Rozhodovací bod:** agent **aktivně informuje** uživatele, že je vhodný čas na produkční deploy (checklist splněn, žádné otevřené bugy z testu).
4. **Potvrzení uživatele:** uživatel výslovně potvrdí výsledky testování (analogicky jako „vše vypadá OK, pokračuj fází N").
5. **Produkční deploy:** podle checklistu v § 0.4.4.
6. **Post-deploy dohled:** prvních 24 h zvýšená bdělost (PM2 logy, smoke testy), připravený rollback.

### 0.4.4 Checklist produkčního deploymentu (pro každý balík)

- [ ] Všechny fáze balíku uzavřeny na `test` větvi a úspěšně nasazeny na test server
- [ ] `npx tsc --noEmit` – 0 chyb na test serveru
- [ ] Stabilizační okno (1–2 týdny) běželo bez nahlášených regresních chyb
- [ ] Plný `mysqldump` produkční DB před deployem (uložit do `backups/pre_production_balik_<X>_<TS>.sql`)
- [ ] Snapshot `prisma/schema.prisma` v Git tagu `pre-prod-balik-<X>`
- [ ] Deploy mimo pracovní dobu, nebo s avízem 2–5 minutové nedostupnosti
- [ ] Reverzní SQL (pro schema-měnící balíky) připraven v `prisma/migrations/<timestamp>/rollback.sql`
- [ ] Konkrétní rollback plán napsaný předem (git revert + schema rollback + DB restore)
- [ ] Smoke test okamžitě po deployi na produkčním portu (3010)
- [ ] Kontrola PM2 logů (žádné nové error stacky)
- [ ] Ověření non-IML modulů (kalendář, kontakty, úkoly) – že jsme nerozbili nic sdíleného
- [ ] Oznámení uživatelům, že balík `<X>` je nasazen, s krátkým soupisem novinek

### 0.4.5 Role agenta

- Během vývoje agent **průběžně commituje na `test` větev** a deployuje na test server po dokončení každé fáze.
- Když je balík hotový a stabilizační okno uplynulo bez problémů, agent **proaktivně upozorní**: „Balík X je připraven na produkci. Checklist 0.4.4 je splněn. Potvrď prosím výsledky testování a spusťme deploy."
- Produkční deploy proběhne pouze po **výslovném potvrzení uživatele**.
- Agent **nikdy** nenasadí na produkci z vlastní iniciativy, ani při „hotové" fázi bez balíku.

---

## Fáze 1 — Datový model + migrace

**Cíl:** přidat nové tabulky, rozšířit stávající, připravit data migration skript.

### 1.1 Prisma schéma – nové modely

- [x] `iml_customer_shipping_addresses`
- [x] `iml_foils`
- [x] `iml_pantone_colors`
- [x] `iml_product_colors`
- [x] `iml_product_files`
- [x] `iml_inquiries`
- [x] `iml_inquiry_items`

Referenční definice:

```prisma
model iml_customer_shipping_addresses {
  id             Int      @id @default(autoincrement())
  customer_id    Int
  label          String?  @db.VarChar(100)
  recipient      String?  @db.VarChar(255)
  street         String?  @db.VarChar(255)
  city           String?  @db.VarChar(100)
  postal_code    String?  @db.VarChar(20)
  country        String?  @default("Česká republika") @db.VarChar(100)
  is_default     Boolean  @default(false)
  label_requirements String? @db.Text
  pallet_packaging   String? @db.Text
  prepress_notes     String? @db.Text
  created_at     DateTime @default(now()) @db.DateTime(0)
  updated_at     DateTime @updatedAt @db.DateTime(0)
  iml_customers  iml_customers @relation(fields: [customer_id], references: [id], onDelete: Cascade)
  @@index([customer_id])
  @@index([customer_id, is_default])
  @@map("iml_customer_shipping_addresses")
}

model iml_foils {
  id         Int      @id @default(autoincrement())
  code       String   @unique @db.VarChar(50)
  name       String   @db.VarChar(255)
  thickness  String?  @db.VarChar(50)
  note       String?  @db.Text
  is_active  Boolean  @default(true)
  created_at DateTime @default(now()) @db.DateTime(0)
  updated_at DateTime @updatedAt @db.DateTime(0)
  iml_products iml_products[]
  @@map("iml_foils")
}

model iml_pantone_colors {
  id         Int      @id @default(autoincrement())
  code       String   @unique @db.VarChar(32)
  name       String?  @db.VarChar(100)
  hex        String?  @db.VarChar(7)
  is_active  Boolean  @default(true)
  created_at DateTime @default(now()) @db.DateTime(0)
  iml_product_colors iml_product_colors[]
  @@map("iml_pantone_colors")
}

model iml_product_colors {
  id           Int     @id @default(autoincrement())
  product_id   Int
  pantone_id   Int
  coverage_pct Decimal @db.Decimal(5, 2)
  sort_order   Int     @default(0)
  created_at   DateTime @default(now()) @db.DateTime(0)
  iml_products       iml_products       @relation(fields: [product_id], references: [id], onDelete: Cascade)
  iml_pantone_colors iml_pantone_colors @relation(fields: [pantone_id], references: [id])
  @@unique([product_id, pantone_id])
  @@index([product_id])
  @@index([pantone_id])
  @@map("iml_product_colors")
}

model iml_product_files {
  id          Int      @id @default(autoincrement())
  product_id  Int
  version     Int
  filename    String   @db.VarChar(255)
  file_size   Int
  mime_type   String   @db.VarChar(100)
  pdf_data    Bytes    @db.LongBlob
  is_primary  Boolean  @default(true)
  uploaded_by Int
  uploaded_at DateTime @default(now()) @db.DateTime(0)
  iml_products iml_products @relation(fields: [product_id], references: [id], onDelete: Cascade)
  users        users        @relation(fields: [uploaded_by], references: [id])
  @@unique([product_id, version])
  @@index([product_id, is_primary])
  @@map("iml_product_files")
}

model iml_inquiries {
  id                 Int       @id @default(autoincrement())
  customer_id        Int
  inquiry_number     String    @unique @db.VarChar(50)
  inquiry_date       DateTime  @db.DateTime(0)
  status             String    @default("nová") @db.VarChar(50)
  notes              String?   @db.Text
  converted_order_id Int?      @unique
  custom_data        Json?     @db.Json
  created_at         DateTime  @default(now()) @db.DateTime(0)
  updated_at         DateTime  @updatedAt @db.DateTime(0)
  iml_customers     iml_customers       @relation(fields: [customer_id], references: [id])
  iml_inquiry_items iml_inquiry_items[]
  iml_orders        iml_orders?         @relation("inquiry_to_order", fields: [converted_order_id], references: [id])
  @@index([customer_id])
  @@index([status])
  @@index([inquiry_date])
  @@map("iml_inquiries")
}

model iml_inquiry_items {
  id         Int      @id @default(autoincrement())
  inquiry_id Int
  product_id Int
  quantity   Int
  unit_price Decimal? @db.Decimal(10, 2)
  subtotal   Decimal? @db.Decimal(10, 2)
  created_at DateTime @default(now()) @db.DateTime(0)
  iml_inquiries iml_inquiries @relation(fields: [inquiry_id], references: [id], onDelete: Cascade)
  iml_products  iml_products  @relation(fields: [product_id], references: [id])
  @@index([inquiry_id])
  @@index([product_id])
  @@map("iml_inquiry_items")
}
```

### 1.2 Prisma schéma – rozšíření stávajících

- [x] `iml_customers`: `billing_company`, `ico`, `dic`, `label_requirements`, `pallet_packaging`, `prepress_notes` + relace `iml_customer_shipping_addresses[]`, `iml_inquiries[]`
- [x] `iml_products`:
  - `foil_id` + relace `iml_foils`, `iml_product_colors[]`, `iml_product_files[]`, `iml_inquiry_items[]`
  - **`labels_per_sheet Int?`** (NOVÉ – počet etiket na tiskový arch, klíčový vstup pro výpočet spotřeby barvy dle C.1). Nullable kvůli zpětné kompatibilitě; validace: pokud `> 0` při uložení, jinak `NULL`.
- [x] `iml_orders`: `inquiry_id`, `shipping_address_id`, `shipping_snapshot_*` (label, recipient, street, city, postal_code, country) + relace `iml_inquiries[] @relation("inquiry_to_order")`

### 1.2.1 Povinné zpětné relace v modelu `users` (izolace – viz 0.3.3)

Model `users` je sdílený. Pro každou novou FK na `users` **musí** být doplněna zpětná kolekce, jinak `prisma validate` selže a **rozbije** generování klienta pro **všechny moduly**.

- [x] `iml_product_files_uploaded iml_product_files[] @relation("iml_product_files_uploader")`
- [ ] Pokud ve Fázi 5 přibude `iml_orders.created_by`, přidat `iml_orders_created iml_orders[] @relation("iml_orders_created_by")` (volitelné – jinak vést jen přes `audit_log`).

### 1.2.2 Ověření izolace po migraci

- [x] `npx prisma validate` → OK
- [x] `npx prisma generate` → OK, žádné varování o chybějících zpětných relacích
- [x] Smoke test dle matice 0.3.7 – všechny non-IML moduly vrací 200 *(počty záznamů ověřeny: users=45, planovani_blocks=134, ukoly=1, calendar_events=64, audit_log=292 — beze změny)*

### 1.3 Data-migration skript

Soubor `scripts/iml-newsec-phase1-migrate.mjs` (idempotentní, s `--dry-run`):

- [x] CLI flag `--dry-run` – pouze reportuje plán (counts, prvních 10 záznamů), nic nezapisuje
- [x] Konverze `iml_customers.shipping_address` → 1× záznam v `iml_customer_shipping_addresses` (`is_default=true`) *(na localhostu: 0 záznamů k migraci – všechny shipping_address NULL)*
- [x] Deduplikace `iml_products.foil_type` → `iml_foils` + set `foil_id` *(na localhostu: 0 záznamů k migraci – všechny foil_type prázdné)*
- [x] Pro produkty s `pdf_data` vytvoř `iml_product_files` verzi 1 (`is_primary=true`, `uploaded_by = první admin`, `filename="legacy.pdf"`) *(na localhostu: 2 produkty, 670 kB + 16 MB)*
- [x] `individual_requirements` **ponechat** beze změny (přemigruje se ve Fázi 2/7)
- [x] Skript **nevytváří** záznamy v `audit_log` (legacy migrace, ne uživatelská akce)
- [x] Skript **nemění** data jiných modulů (použitý Prisma klient volá výhradně `iml_*` modely + read-only `users.findFirst` pro admin ID)

### 1.4 Akceptační kritéria

- [x] Migrace proběhla bez chyby *(přes `prisma migrate diff` + manuální `mysql < migration.sql`, protože `prisma migrate dev` by chtěla reset DB – viz git.md 7.6 / P3005)*
- [x] `prisma validate` + `prisma generate` + `prisma migrate diff` (No difference detected) OK
- [x] Data-migration skript je idempotentní (druhý běh reportuje „0 vytvořeno, 2 přeskočeno")
- [x] Stávající `/api/iml/*` endpointy fungují beze změn *(data zachována: 1 zákazník, 142 produktů, FK constraints intaktní)*
- [x] Non-IML smoke test dle matice 0.3.7 – všechny moduly OK
- [x] Záloha DB uložena: `backups/pre_iml_newsec_phase1_2026-04-22_0711.sql` (20,87 MB)
- [x] **Plný TS typecheck:** `npx tsc --noEmit` → 0 chyb (celý projekt, trvalo ~33 s)

---

## Fáze 2 — Zákazníci: multi-shipping + strukturovaná fakturace

### 2.1 API

- [x] `app/api/iml/customers/[id]/shipping-addresses/route.ts` – `GET`, `POST` (atomic flip defaultu)
- [x] `app/api/iml/customers/[id]/shipping-addresses/[addressId]/route.ts` – `GET`, `PUT`, `DELETE` (při mazání defaultu přenést na jinou)
- [x] `app/api/iml/customers/route.ts` – `POST` rozšířen o `billing_company`, `ico`, `dic`, `label_requirements`, `pallet_packaging`, `prepress_notes`
- [x] `app/api/iml/customers/[id]/route.ts` – `PUT` totéž

### 2.2 UI

- [x] `app/(dashboard)/iml/customers/add/page.tsx` – rozdělení na sekce: Identifikace / Fakturační údaje / Individuální požadavky / Ostatní
- [x] `app/(dashboard)/iml/customers/[id]/edit/page.tsx` – totéž (+ zachování legacy `shipping_address` při ukládání)
- [x] `app/(dashboard)/iml/customers/[id]/page.tsx` – přidat sekci „Doručovací adresy"
- [x] Nová komponenta `app/(dashboard)/iml/customers/_components/CustomerShippingAddresses.tsx`
  - seznam adres, modal add/edit, tlačítko „Nastavit jako výchozí"

### 2.3 Akceptační kritéria

- [x] Zákazník má IČO, DIČ, rozdělená individuální pole
- [x] Vždy max. 1 doručovací adresa s `is_default=true` / zákazník (atomic flip v transakci)
- [x] Mazání defaultu přenáší default na jinou (pokud existuje) – transakce: delete + promote nejstarší
- [x] Audit log obsahuje záznamy pro `iml_customer_shipping_addresses` (create/update/delete)

### 2.7 Validace vstupních polí (doplněk k F2)

**Cíl:** zajistit, aby e-mail, telefon, IČO a DIČ odpovídaly legislativnímu / standardnímu formátu – jak na klientovi (okamžitá UX zpětná vazba), tak na serveru (bezpečnost).

#### 2.7.1 Formáty a pravidla

| Pole | Pravidlo | Normalizace při uložení |
|---|---|---|
| **E-mail** | `local@domain.tld`, TLD ≥ 2 znaky, bez mezer | trim + lowercase domain |
| **Telefon** | `+420` / `+421` / holých 9 číslic; volitelné mezery a `-` | `+420 XXX XXX XXX` (trojčíslí oddělená jednou mezerou) |
| **IČO (CZ)** | 8 číslic, kontrolní součet **modulo 11** dle ARES; povolit 7-míst s leading zero | vždy 8 číslic bez mezer |
| **DIČ (CZ/SK)** | `CZ` + 8–10 číslic / `SK` + 9–10 číslic | uppercase, bez mezer |

#### 2.7.2 Implementace

- [x] Nové centrální utility `lib/iml-validation.ts`: funkce `validateEmail`, `validateCzPhone`, `validateIco`, `validateDic`, všechny vracejí `{ ok, value, error? }`. Bez externích závislostí, čisté funkce (testovatelné bez DOM/DB).
- [x] **Server** (`POST /api/iml/customers`, `PUT /api/iml/customers/[id]`) – validace před zápisem, při chybě vrací `400` s konkrétní zprávou (`{ error, field }`).
- [x] **Klient** (`CustomerFormSections.tsx`) – validace on-blur + blokující kontrola při submitu; chyba se zobrazí červeně pod polem a pole dostane `aria-invalid`.
- [x] Duplicita e-mailu (existující kontrola) zůstává, jen se spouští až po formátové validaci.

#### 2.7.3 Akceptační kritéria

- [x] Nevalidní e-mail / telefon / IČO (špatný kontrolní součet) / DIČ – formulář **nelze odeslat**, zobrazí se inline chyba u konkrétního pole.
- [x] Normalizace probíhá transparentně: uživatel může napsat `+420-602 123 456` a uloží se `+420 602 123 456`.
- [x] Prázdná pole (všechna krom `name`) jsou povolená – validace se spouští jen u vyplněných.
- [x] Utility pokryté unit testy: `tests/iml-validation.test.ts` (optional – spustit až v F7, pokud se zavede `vitest`).

---

## Fáze 3 — Produkty: taby, Fólie, Pantone, verzování PDF, stavy

### 3.1 Taby v UI

- [ ] Nová komponenta `app/(dashboard)/iml/_components/Tabs.tsx` (bez nové dependence)
- [ ] `products/add/page.tsx` – 4 taby (Identifikace / Výseky / Materiály / Tisková data)
- [ ] `products/[id]/edit/page.tsx` – totéž
- [ ] Stav tabu v URL (`?tab=id|cut|material|print`) přes `useSearchParams` + `router.replace`

### 3.2 Fólie (číselník)

- [ ] `app/api/iml/foils/route.ts` (`GET`, `POST`)
- [ ] `app/api/iml/foils/[id]/route.ts` (`GET`, `PUT`, `DELETE` – soft-delete, 409 pokud je navázaný produkt)
- [ ] `app/(dashboard)/iml/settings/foils/page.tsx` – správa (kód, název, tloušťka, stav)
- [ ] Propojit ze `settings/page.tsx` jako druhou záložku vedle „Vlastní pole"
- [ ] Dropdown `foil_id` v tabu Materiály (fallback zobrazí legacy `foil_type` k remapování)

### 3.3 Pantone barvy + výpočet spotřeby (F3.4)

- [x] `app/api/iml/pantone-colors/route.ts` (`GET` se `search` a `?all=true`, `POST` s normalizací/validací)
- [x] `app/api/iml/pantone-colors/[id]/route.ts` (`GET`, `PUT`, `DELETE` – soft-delete, 409 pokud je barva navázaná na produkty)
- [x] `app/api/iml/pantone-colors/validate/route.ts` (`POST { code }` → `{ normalized, exists, id, color }`)
- [x] `app/api/iml/products/[id]/colors/route.ts` (`GET`, `PUT` – replace semantika v transakci; 422 při neznámých kódech se seznamem `missing_codes`)
- [x] `lib/iml-pantone.ts` – `normalizePantoneCode(raw)` (trim, toUpperCase, collapse whitespace, `P<digit> → P <digit>`; slovo „PANTONE" se záměrně nemění) + `isValidPantoneCode`
- [x] `lib/iml-color-consumption.ts` – `consumptionKg(pieces, labelsPerSheet, coveragePct)` dle vzorce **Příloha C.1**
- [x] `lib/iml-product-colors.ts` – sdílený helper `validateProductColorsInput` + `replaceProductColorsInTx` (reuse v `/api/iml/products` POST/PUT i v dedikovaném `/colors` endpointu)
- [x] Unit testy: `lib/iml-color-consumption.test.ts` (15 testů) + `lib/iml-pantone.test.ts` (10 testů)
- [x] Komponenta `products/_components/ProductPantoneEditor.tsx` – dynamické řádky, onBlur → `/api/iml/pantone-colors/validate`, Enter → focus na pokrytí, hint u neznámých kódů („Vytvoří se při uložení produktu"), live preview spotřeby na ref. nákladu 10 000 ks
- [x] Tlačítko `+ Přidat barvu`, validace pokrytí 0–100 (client-side i server-side)
- [x] UI (tab Výseky) – input **„Počet etiket na tiskový arch (TA)"** (`labels_per_sheet`), typu `Int`, min 1, volitelný; helper text: „Potřebné pro výpočet spotřeby barvy v reportu (viz tab Barvy)."
- [x] Editor Pantone zobrazuje živý preview spotřeby pro referenční náklad 10 000 ks – pokud `labels_per_sheet` není vyplněno, žluté upozornění „Doplňte Počet etiket na tiskový arch…"
- [x] POST /api/iml/products i PUT /api/iml/products/[id] nově volitelně přijímají `colors: IncomingProductColor[]` (auto_create=true) – uložení proběhne v jedné transakci s produktem
- [x] 3. záložka v Nastavení IML: **Pantone** (`ImlPantoneColorsClient` + `/api/iml/pantone-colors`)
- [x] Read-only přehled barev v detailu produktu (sekce „Barvy") s HEX swatchem, % pokrytí, spotřebou na ref. nákladu a součtem pokrytí

> **Poznámka k Příloze C.2**: referenční regex v původní specifikaci (`/^P(?!\s)/`) by mylně zasahoval i do slova „PANTONE" (výsledek „P ANTONE"). Skutečná implementace používá `/^P(?=\d)/`, takže:
> – `"pantone 485 C"` → `"PANTONE 485 C"`
> – `"p1234"` → `"P 1234"` (zachováno)
> – `"P 485 C"` → `"P 485 C"` (beze změny)
> Unit testy v `lib/iml-pantone.test.ts` tuto variantu pokrývají.

### 3.4 Verzování PDF + limit 50 MB

- [x] `app/api/iml/products/[id]/pdf/route.ts` – `MAX_PDF_SIZE = 50 * 1024 * 1024`
- [x] `GET ?version=N` – načte konkrétní verzi, jinak primary; fallback na legacy `iml_products.pdf_data`
- [x] `POST` – vytvoří novou verzi (`max(version)+1`), starou přepne `is_primary=false` (transakce + magic-bytes check `%PDF-`)
- [x] `DELETE` – downgrade na předchozí verzi (pokud existuje), jinak fallback na legacy blob
- [x] `app/api/iml/products/[id]/pdf/versions/route.ts` – `GET` (list bez blobů, s info o uploaderovi), `DELETE ?version=N` (primary nelze)
- [x] `app/api/iml/products/[id]/pdf/versions/[version]/primary/route.ts` – `PATCH` pro obnovu staré verze jako primární
- [x] UI tab „Tisková data" – tabulka historie verzí (`ProductPdfHistory.tsx`): verze, filename, velikost, uploader, datum + akce (stáhnout / obnovit / smazat)
- [x] `next.config.ts` – `bodySizeLimit` a `proxyClientMaxBodySize` zvýšeny z `20mb` na `60mb` (rezerva nad 50 MB PDF)
- [x] UI upload (`ProductFilesUpload.tsx`, `ProductFilesUploadPlaceholder.tsx`) – hint změněn na „max 50 MB"

**Nasazení na test: PDF se nenahraje, obrázek ano**

- **Nginx (reverse proxy):** `client_max_body_size` výchozí bývá 1m → velké PDF vrátí **413** dřív, než request doputuje do Node. V `server` / `location` pro aplikaci nastavit např. `client_max_body_size 60M;` a `nginx -s reload`. Obrázky do 5 MB často projdou, PDF ne – typický symptóm.
- **MySQL / MariaDB:** ukládáme BLOB do `iml_product_files.pdf_data` – když je `max_allowed_packet` (server i klient) menší než soubor, INSERT selže. Na serveru v `mysqld.cnf` / `my.cnf` např. `max_allowed_packet=64M`, restart DB. API nyní vrátí srozumitelnou chybu, pokud text chyby obsahuje „packet too large“.
- Aplikace musí běžet s buildem, který obsahuje zvýšený limit v `next.config.ts` (po `git pull` na serveru `npm run build` + restart PM2).

### 3.5 Nové stavy

- [ ] `lib/iml-constants.ts` – `IML_ITEM_STATUSES = ["aktivní","archivní","testovací","zablokovaná","rozpracováno grafikem","chyba"]`
- [ ] Všechny `<select>` (add, edit, filtr) používají tuto konstantu

### 3.6 Akceptační kritéria

- [ ] Produktový formulář má 4 taby s persistencí v URL
- [ ] Fólie z dropdownu, Pantone řádky s Enter-skokem a validací
- [ ] Neznámý kód → modal → po vytvoření karty se řádek automaticky použije
- [ ] PDF limit 50 MB, historie verzí funkční (stažení, mazání, obnovení jako primary)
- [ ] Nové stavy dostupné v UI

---

## Fáze 4 — Modul Poptávky (Inquiries)

### 4.1 API

- [ ] `app/api/iml/inquiries/route.ts` (`GET` s filtry, `POST`)
- [ ] `app/api/iml/inquiries/[id]/route.ts` (`GET`, `PUT`, `DELETE` cascade items)
- [ ] `app/api/iml/inquiries/[id]/convert/route.ts` (`POST { order_number }` – transakce: create order → copy items → update inquiry `status="překlopená"`, `converted_order_id`)
- [ ] Rozšířit whitelist `iml_custom_fields.entity` o `"inquiries"` v `app/api/iml/custom-fields/route.ts`

### 4.2 UI

- [ ] `app/(dashboard)/iml/inquiries/page.tsx` + `InquiriesClient.tsx`
- [ ] `app/(dashboard)/iml/inquiries/add/page.tsx`
- [ ] `app/(dashboard)/iml/inquiries/[id]/page.tsx` + tlačítko „Překlopit do objednávky" (modal s `order_number`)
- [ ] `app/(dashboard)/iml/inquiries/[id]/edit/page.tsx`
- [ ] Dashboard (`app/(dashboard)/iml/page.tsx`) – přidat kartu „Poptávky" + konverzní poměr

### 4.3 Akceptační kritéria

- [ ] CRUD poptávek funkční včetně `custom_data`
- [ ] Překlopení je idempotentní (opakované volání vrátí 409)
- [ ] Původní poptávka má odkaz na vzniklou objednávku
- [ ] Dashboard zobrazuje konverzní poměr (poslední 12 měsíců)

---

## Fáze 5 — Objednávky: Smart UI, snapshot, validace, XML

### 5.1 Smart UI výběru produktů

- [ ] Po volbě zákazníka načíst `GET /api/iml/products?customer_id=X&item_status=aktivní`
- [ ] Tabulka: Kód | Název u klienta | Skladem | Množství | Cena/ks | Akce
- [ ] In-line `<input type="number">` pro množství, ukládá se jen `quantity > 0`
- [ ] Vyhledávací input (lupa) – debounce 200 ms, reagovat od 3. znaku

### 5.2 Validace stavu produktu

- [ ] `POST/PUT /api/iml/orders` vrací 409 pro neaktivní produkt, pokud `supervisor_override !== true`
- [ ] **Nový soubor** `lib/iml-permissions.ts` (NE úpravu `lib/auth-utils.ts`!):
  - `export async function hasImlSupervisorOverride(userId: number): Promise<boolean>` – používá existující `getModuleAccessItems(userId)` a hledá `"iml.supervisor_override"` nebo `"iml.admin"`.
- [ ] Parser `module_access` v `lib/auth-utils.ts` **neměnit** – stávající pole-formát `["iml.write","iml.supervisor_override"]` už parser vrací přes `getModuleAccessItems`.
- [ ] UI – inline badge u neaktivního řádku + modal při submitu s checkboxem (aktivní pouze pro supervisora)
- [ ] Izolace: nový kód akce `iml.supervisor_override` **nesmí** ovlivnit ostatní moduly (parser je generic, test: uživatel bez IML role nemá tuto akci v items)

### 5.3 Doručovací adresa + snapshot

- [ ] UI – select doručovací adresy (pouze adresy daného zákazníka)
- [ ] Backend – po create načíst aktuální data adresy a uložit do `shipping_snapshot_*`
- [ ] Detail objednávky – vykreslovat **ze snapshotů**, ne z live `shipping_address_id`
- [ ] `PUT` objednávky snapshot **nepřepisuje**

### 5.4 XML export (Cicero/Pey)

- [ ] `lib/iml-xml.ts` – escape helper + builder
- [ ] `app/api/iml/orders/[id]/export-xml/route.ts` – `GET` → `Content-Type: application/xml`
- [ ] Minimální schéma `<Order><Header><Customer/><ShippingAddress/></Header><Items/></Order>`
- [ ] Tlačítko „Export XML" v detailu objednávky
- [ ] TODO komentář v kódu pro upřesnění schématu podle Cicero/Pey

### 5.5 Akceptační kritéria

- [ ] Nová objednávka: zákazník → tabulka produktů → in-line množství → našeptávač
- [ ] Nelze uložit objednávku s neaktivním produktem bez supervisor override
- [ ] Snapshot adresy je stabilní (po změně u zákazníka nedochází ke změně na objednávce)
- [ ] XML export validní a obsahuje snapshot

---

## Fáze 6 — Reporting: Četnost barev a plánovaná spotřeba

### 6.1 API

- [ ] `app/api/iml/reports/pantone/route.ts` – `GET` s parametry:
  - `codes` (CSV), `from`, `to`, `statuses` (CSV, default `nová,potvrzená,odeslaná`), `group_by` (`product|customer|pantone_only`), `format` (`json|csv|xlsx`)
- [ ] Raw SQL agregace přes `iml_order_items × iml_products × iml_product_colors × iml_pantone_colors`
- [ ] Pro každý řádek načíst i `iml_products.labels_per_sheet` a předat do výpočtu
- [ ] Spotřebu kg počítat výhradně přes `consumptionKg(pieces, labels_per_sheet, coverage_pct)` z `lib/iml-color-consumption.ts` (žádná duplikace vzorce v SQL)
- [ ] Pokud `labels_per_sheet = NULL`, vrátit `consumption_kg = null` a flag `missing_labels_per_sheet = true` u řádku

### 6.2 UI

- [ ] `app/(dashboard)/iml/reports/pantone/page.tsx`
  - Filtry: Pantone multiselect, Období, Stavy, Seskupení
  - Tabulka: Kód | Produkt | Zákazník | Počet ks | Etiket/TA | Pokrytí % | Spotřeba (kg)
  - Řádky s `labels_per_sheet = NULL` zobrazit žlutě + tooltip „Doplňte u produktu pro přesný výpočet"
  - Footer se sumou kg (pouze přes řádky s vyplněným `labels_per_sheet`) + sekundárně počet neúplných řádků
  - Tlačítka Export CSV / Excel
- [ ] Odkaz z `iml/page.tsx` a bočního menu

### 6.3 Akceptační kritéria

- [ ] Kg sedí s manuálním propočtem dle vzorce **Příloha C.1** na vzorové objednávce (kontrolní příklady z matice C.1)
- [ ] Řádky bez `labels_per_sheet` nejsou do sumy započítány a jsou UI zvýrazněny
- [ ] Report do 2 s při běžném objemu dat
- [ ] Export CSV/Excel funkční (kg + flag chybějícího `labels_per_sheet`)

---

## Fáze 7 — Úklid a finalizace

> **Pozor:** toto je destruktivní fáze. Spouštět **nejdříve 2 týdny** po nasazení Fáze 6 a pouze pokud všechny smoke testy dle 0.3.7 procházejí stabilně.

- [ ] Pre-flight check: ve všech IML tabulkách jsou data konzistentní s novými sloupci (SQL reporty, žádné NULL tam, kde se očekává hodnota).
- [ ] Záloha DB (`/backups/pre_iml_newsec_phase7_<date>.sql`).
- [ ] Migrace `iml_newsec_phase7_cleanup`:
  - [ ] Drop `iml_customers.shipping_address`
  - [ ] Drop `iml_customers.individual_requirements` (po domapování do 3 polí)
  - [ ] Drop `iml_products.foil_type`
  - [ ] Drop `iml_products.color_coverage`
  - [ ] Drop `iml_products.pdf_data` (pouze po ověření kompletní migrace do `iml_product_files` – SQL: `COUNT` legacy vs. `COUNT` verzí musí souhlasit)
  - [ ] `image_data` **zachovat** (migrace mimo scope – může se řešit v dalším inkrementu)
- [ ] `iml_custom_fields.entity` whitelist obsahuje `"inquiries"` (pokud ne z Fáze 4)
- [ ] Aktualizovat `docs/MODUL_IML.md` o novou strukturu
- [ ] Aktualizovat `docs/README.md` – přidat odkaz na tento plán
- [ ] **Non-IML smoke test dle matice 0.3.7** – ověřit, že odstranění legacy sloupců nic nerozbilo (zejména importy/exporty, které mohly sloupce číst)
- [ ] E2E smoke test: Zákazník → Produkt → Poptávka → Překlopení → Objednávka → XML → Report
- [ ] Grep celý repozitář na odstraněné názvy sloupců (`shipping_address`, `foil_type`, `color_coverage`, `pdf_data` v `iml_products`) – nesmí existovat žádný odkaz

---

## Příloha A — Matice oprávnění

| Akce | read | write | supervisor |
|---|:---:|:---:|:---:|
| Prohlížení IML | ✓ | ✓ | ✓ |
| CRUD zákazníků / adres | – | ✓ | ✓ |
| CRUD produktů, upload PDF | – | ✓ | ✓ |
| CRUD poptávek, překlopení | – | ✓ | ✓ |
| CRUD objednávek | – | ✓ | ✓ |
| Objednávka s neaktivním produktem | – | – | ✓ |
| Správa Pantone / Fólie | – | ✓ | ✓ |
| XML export | ✓ | ✓ | ✓ |
| Report spotřeby | ✓ | ✓ | ✓ |

## Příloha B — Pravidla pro agenta

- [ ] Před každou fází ověř `prisma migrate status`
- [ ] Po změně schématu vždy `prisma generate`
- [ ] Žádné `any`, používat `Prisma.<Model>CreateInput` / utility typy
- [ ] Lint po úpravě (`next lint`), fixnout vlastní chyby
- [ ] Pokud existují testy (vitest/jest), přidat unit testy pro `consumptionKg` (dle matice v Příloze C.1), `normalizePantoneCode`, XML builder
- [ ] Vzorec spotřeby barvy (Příloha C.1) a konstantu `1,2 kg / 1000 TA` **nevymýšlet ani neladit** – jsou závazné dle specifikace
- [ ] Commit convention: `feat(iml): phase N – <krátký popis>`
- [ ] Při nejasnosti (např. Cicero/Pey schéma) **nevymýšlet** – TODO komentář + poznámka v PR

## Příloha C — Referenční algoritmy

### C.1 Výpočet spotřeby barvy (sekce 4.2 specifikace)

**Vzorec (závazný):**

```
počet_TA              = náklad / etiket_na_TA
množství_barvy_plné   = (počet_TA / 1000) × 1,2           [kg]   ← 1,2 kg barvy na 1000 celoplošně (100 %) tisknutých archů
finální_barva         = množství_barvy_plné × (pokrytí_% / 100)  [kg]
```

**Zjednodušeně:**

```
finální_barva_kg = (náklad × 1.2 × pokrytí_%) / (etiket_na_TA × 100 000)
```

**Vstupy a jejich zdroj:**

| Vstup | Zdroj | Datový typ | Poznámka |
|---|---|---|---|
| `pieces` (náklad) | `iml_order_items.quantity` (součet za produkt v období) | `Int` | Počet etiket v objednávce |
| `labelsPerSheet` (etiket na TA) | `iml_products.labels_per_sheet` (NOVÉ POLE – viz 1.2) | `Int?` | Pokud `NULL`, výpočet vrátí `null` a řádek je v reportu označen jako „Nelze spočítat – doplnit labels_per_sheet" |
| `coveragePct` (pokrytí) | `iml_product_colors.coverage_pct` (per Pantone barva) | `Decimal(5,2)` | Rozsah 0–100 (ne 0–1) |

**Konstanta:**

| Konstanta | Hodnota | Umístění |
|---|---|---|
| `FULL_COVERAGE_KG_PER_1000_SHEETS` | `1.2` | `lib/iml-color-consumption.ts` jako `export const FULL_COVERAGE_KG_PER_1000_SHEETS = 1.2` |

> **Poznámka:** Konstanta 1,2 kg je **dohodnutá technologická hodnota** (cca barvy na 1000 celoplošných archů) – nevymýšlet jiné číslo. Pokud se v budoucnu bude ladit, přesunout do `system_settings` klíč `iml.full_coverage_kg_per_1000_sheets`, ale v první iteraci držet konstantu v kódu.

**Helper (referenční implementace):**

```ts
// lib/iml-color-consumption.ts
export const FULL_COVERAGE_KG_PER_1000_SHEETS = 1.2;

/**
 * Spotřeba barvy v kg na jednu Pantone barvu daného produktu pro daný náklad.
 *
 * Vzorec:
 *   sheets            = pieces / labelsPerSheet
 *   fullCoverageKg    = (sheets / 1000) * 1.2
 *   result            = fullCoverageKg * (coveragePct / 100)
 *
 * @param pieces         Náklad (počet etiket v objednávce). Musí být > 0.
 * @param labelsPerSheet Počet etiket na tiskový arch (iml_products.labels_per_sheet). Musí být > 0, jinak null.
 * @param coveragePct    Pokrytí barvy v procentech 0–100 (iml_product_colors.coverage_pct).
 * @returns Spotřeba v kg, zaokrouhleno na 4 des. místa. Vrací null, pokud nelze spočítat.
 */
export function consumptionKg(
  pieces: number,
  labelsPerSheet: number | null | undefined,
  coveragePct: number
): number | null {
  if (!Number.isFinite(pieces) || pieces <= 0) return null;
  if (!Number.isFinite(labelsPerSheet as number) || !labelsPerSheet || labelsPerSheet <= 0) return null;
  if (!Number.isFinite(coveragePct) || coveragePct < 0) return null;

  const sheets = pieces / labelsPerSheet;
  const fullCoverageKg = (sheets / 1000) * FULL_COVERAGE_KG_PER_1000_SHEETS;
  const result = fullCoverageKg * (coveragePct / 100);

  return Math.round(result * 10000) / 10000;
}
```

**Kontrolní příklady (pro unit testy):**

| Náklad | Etiket/TA | Pokrytí % | Očekávaný výsledek (kg) |
|---:|---:|---:|---:|
| 100 000 | 100 | 100 | **1,2** |
| 100 000 | 100 | 50 | **0,6** |
| 100 000 | 100 | 30 | **0,36** |
| 50 000 | 50 | 100 | **1,2** |
| 10 000 | 20 | 25 | **0,15** |
| 0 | 100 | 50 | `null` |
| 100 000 | 0 nebo `null` | 50 | `null` (chybějící `labels_per_sheet`) |
| 100 000 | 100 | `null`/záporné | `null` |

### C.2 Normalizace Pantone kódu

```ts
// lib/iml-pantone.ts (skutečná implementace)
export function normalizePantoneCode(raw: string): string {
  if (typeof raw !== "string") return "";
  return raw
    .trim()
    .toUpperCase()
    .replace(/\s+/g, " ")
    // P následované číslicí doplníme mezerou (P1234 → P 1234).
    // Nepoužíváme `(?!\s)`, protože by to matchlo i "PANTONE" a zlomilo ho na "P ANTONE".
    .replace(/^P(?=\d)/, "P ");
}
```

Kontrolní příklady (kryté `lib/iml-pantone.test.ts`):

| Vstup | Výstup |
|---|---|
| `"  pantone 485 C "` | `"PANTONE 485 C"` |
| `"p1234"` | `"P 1234"` |
| `"P 485 C"` | `"P 485 C"` |
| `"p\t485\t c"` | `"P 485 C"` |
| `"BLACK 6 C"` | `"BLACK 6 C"` |
