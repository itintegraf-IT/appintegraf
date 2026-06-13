# Modul IML – Kompletní dokumentace

Modul IML slouží ke správě zákazníků, katalogu produktů a objednávek v rámci aplikace INTEGRAF. Tento dokument slučuje veškerou dokumentaci modulu z původních souborů `MODUL_IML.md`, `NAVRH_MODULU_IML.md`, `Readme_IML.md` a `pozadavky_IML.txt`.

---

## 1. Přehled a rychlý start

### 1.1 Přehled stránek

| Funkce | Cesta | Popis |
|--------|-------|-------|
| Dashboard IML | `/iml` | Přehled, statistiky, konverze poptávek, poslední objednávky |
| Zákazníci | `/iml/customers` | Evidence zákazníků, dodací adresy, CRUD, export, import |
| Produkty | `/iml/products` | Katalog produktů – záložky Identifikace, Výseky, Materiály, Barvy (Pantone), Tisková data |
| Poptávky | `/iml/inquiries` | Evidence poptávek, konverze na objednávku |
| Objednávky | `/iml/orders` | Objednávky, snapshot adresy, export CSV/Excel/XML, import |
| Report Pantone | `/iml/reports/pantone` | Plánovaná spotřeba barev (report) |
| Tisk objednávky | `/iml/orders/[id]/print` | HTML sestava pro tisk / uložení PDF |
| Nastavení | `/iml/settings` | Vlastní pole, číselníky |

### 1.2 Rychlý start

1. **Oprávnění** – v administraci uživatelů přiřaďte modul IML a úroveň (read/write/admin).
2. **Vlastní pole** – v Nastavení IML definujte vlastní pole pro produkty nebo objednávky.
3. **Import** – CSV/Excel lze importovat na stránkách zákazníků, produktů a objednávek.

#### 1.2.1 Profily uživatelů (Prohlížeč / Editor / Administrátor modulu)

Oprávnění se ukládají do `roles.module_access` nebo `user_roles.module_access` ve formě **JSON objektu** nebo **pole řetězců** (viz `lib/auth-utils.ts`, funkce `hasModuleAccess`). Modul se jmenuje `iml`.

| Profil | Účel | Příklad `module_access` (objekt) | Příklad (pole akcí) |
|--------|------|-----------------------------------|----------------------|
| **Prohlížeč** | Čtení seznamů a detailů, exporty kde API dovolí `read` | `{ "iml": "read" }` | `["iml"]`, `["iml.view"]` |
| **Editor** | CRUD zákazníků, produktů, poptávek, objednávek | `{ "iml": "write" }` | `["iml.write"]` (nebo kombinace `iml.add` / `iml.edit` dle role) |
| **Administrátor modulu IML** | Totéž co editor + obvykle správa nastavení (Pantone, vlastní pole), dle matice v implementačním plánu | `{ "iml": "admin" }` | doplňkově např. `iml.supervisor_override` pro výjimky u neaktivních produktů v objednávce |

Globální role uživatele **Admin** (jméno role) má přístup ke všem modulům bez ohledu na `module_access`.

**Tip pro testovací účty (např. kolegyně s omezeným přístupem):** v administraci rolí vytvořte roli „IML prohlížeč“ s `{ "iml": "read" }` a přiřaďte ji uživateli; pro plnou editaci použijte `{ "iml": "write" }`.

### 1.3 Shrnutí modulu

| Položka | Hodnota |
|---------|---------|
| **Modul** | IML |
| **Cesta** | `/iml` |
| **Tabulky** | `iml_customers`, `iml_products`, `iml_orders`, `iml_order_items`, `iml_inquiries`, `iml_inquiry_items`, `iml_product_files`, `iml_pantone_colors`, `iml_product_colors`, `iml_customer_shipping_addresses`, `iml_custom_fields`, … |
| **Oprávnění** | `iml` (read/write/admin) |
| **Technologie** | Next.js App Router, Prisma, stávající UI komponenty |
| **Katalog materiálů** | Vazba na modul [MODUL_MATERIALY.md](./MODUL_MATERIALY.md) – výběr fólie, barvy, papíru, laku na produktu |

### Rozšíření newsec (implementováno)

- **Poptávky** (`/iml/inquiries`) – evidence, položky, konverze na objednávku
- **Verzování PDF** – tabulka `iml_product_files`, primární verze, historie
- **Pantone barvy** na produktu + report spotřeby (`/iml/reports/pantone`)
- **Dodací adresy** zákazníka, snapshot adresy na objednávce
- Detailní checklist: [IML_NEWSEC_IMPLEMENTATION.md](./IML_NEWSEC_IMPLEMENTATION.md)

---

## 2. Účel modulu

Modul IML poskytuje:

- **Evidence zákazníků (klientů)** – kontakty, adresy, individuální požadavky, % odchylka pod-/nadnákladu
- **Katalog produktů** – identifikace, výseky, montáže, materiály, tisk, schvalování, historie
- **Objednávky** – vazba zákazník ↔ produkty, množství, ceny, stavy
- **Statistiky** – historie objednávek, poslední výroba, průměrná objednávka

---

## 3. Požadavky (zdroj: pozadavky_IML.txt)

### 3.1 Produkt – identifikace a sekce

- Kód produktu (IG), Název zkrácený (IG), Kód produktu (klient), Název originální (klient)
- Náhled (jpg), Zadavatel

### 3.2 Formulář produktu – záložky (UI)

| Záložka | Pole |
|---------|------|
| **Identifikace** | Zákazník, kódy IG/klient, zadavatel, SKU |
| **Výseky** | Tvar etikety, výsek, montáž, pozice na archu, etiket na TA (`labels_per_sheet`), balení |
| **Materiály** | Papír, fólie, **barevnost (katalog materiálů)**, lak, poznámky k tisku/výrobě |
| **Barvy** | Pantone řádky + % pokrytí, live preview spotřeby (závisí na `labels_per_sheet`) |
| **Tisková data** | Schválení + datum, stav položky, verze PDF, sklad, **formát š/v (mm)**, počet barev, souhrn barev (text), etiketa (řezaná/výsek), EAN, vzor min. tisku, nátisk, log, interní pozn. |

**Spotřeba barvy (kg):** počítá se výhradně z řádků na záložce **Barvy** (`iml_product_colors.coverage_pct`) a `labels_per_sheet`. Katalogová barevnost na Materiálech (`color_material_id`, `color_coverage`) je metadata pro sklad/export – do vzorce `consumptionKg` nevstupuje. CMYK dle specifikace také nevstupuje do kg algoritmu.

### 3.3 Výseky a montáže

- Kódové označení tvaru etikety, Kód výsekového nástroje, Kód montáže
- Počet pozic na Tiskovém Archu, Počet etiket na TA, Počet kusů v krabici, Počet KS/krabic na paletě

### 3.4 Materiály

- Název/druh fólie, Barevnost (katalog) + volitelná poznámka / % pokrytí, Lak, Poznámka k tisku, Výrobní poznámky

### 3.5 Tisková data a schvalování

- Stav schválení, Datum schválení, Rozměr š/v v mm (`format_width_mm`, `format_height_mm` → odvozený `product_format`)
- Počet barev (1–8), Barvy souhrn (volný text), Etiketa (řezaná / s výsekem)
- EAN, Vzor min. tisku, Nátisk, LOG realizací, Interní poznámka
- Tisková data (PDF), verze, sklad

### 3.6 Metadata produktu

- Datum založení, Datum poslední aktualizace, Kdo naposledy editoval
- Stav položky (aktivní/archivní/testovací/zablokovaná), Verze tiskových dat, Skladová zásoba

### 3.7 Sekce Klient (zákazník)

- **Skupina zákazníků:** centrála (`unit_type=headquarters`) a pobočky (`branch`). Samostatného zákazníka (`standalone`) lze ve formuláři **Přidat / Upravit** převést na centrálu zaškrtnutím pole **Centrála** v sekci Identifikace (pod kontaktními poli); po uložení lze přidat pobočky.
- **Objednávka / poptávka:** `customer_id` = konkrétní jednotka (centrála nebo pobočka); doručovací adresy jen z té jednotky.
- **Katalog produktů:** sdílený na úrovni skupiny – `iml_products.customer_id` = ID centrály; pobočka i centrála objednávají stejné produkty (`resolveCatalogCustomerId`).
- Více **e-mailů** (obecný, objednávky) v samostatné sekci formuláře a **e-mail pro fakturaci** ve fakturačních údajích (ukládá se jako `iml_customer_emails` s `kind=billing`); **kontaktní osoby**; stejný e-mail u více zákazníků je povolen.
- **Přílohy zákazníka** (záložka Přílohy na detailu i ve formuláři Přidat/Upravit): nahrání PDF, Word, Excel přes `file_uploads` (`module=iml_customers`, max. 20 MB / soubor); u nového zákazníka až po prvním uložení, u úpravy ihned na záložce Přílohy.
- **Telefony** mezinárodně (`libphonenumber-js`); země pro parsování telefonu se odvozuje od VAT prefixu (`vatPrefixToPhoneCountry`, u Řecka **EL → GR**).
- **Země daně (`tax_country`)** – výběr ze všech **27 členských států EU** (VAT prefix; Řecko = **EL**, ne ISO `GR`) nebo **Jiná země (mimo EU)** → v API `null`, volná validace IČ/DIČ.
- **IČ / identifikační číslo:** pro **CZ** kontrolní součet dle ARES (`validateIco`); pro **SK** 8–10 číslic; pro ostatní EU národní formát (regex dle státu, obecně 2–15 alfanumerických znaků); mimo EU 2–32 znaků.
- **DIČ (VAT):** pro každý EU stát lokální validace formátu regexem včetně prefixu (`lib/iml-eu-tax.ts`, `validateEuVat`) – např. `DE123456789`, `ATU12345678`, `NL123456789B01`, `EL123456789`. **Online ověření VIES zatím není** (plánováno později).
- Doručovací adresa: pole **poznámka k expedici** (`expedition_note`).
- Legacy pole `email`, `phone`, `contact_person` se synchronizují z primárních záznamů pro zpětnou kompatibilitu.
- **Pobočka** je plnohodnotná jednotka: kontaktní a fakturační adresa, více e-mailů a kontaktních osob. Správa **centrály, poboček a doručovacích adres** probíhá na jedné stránce **Přidat / Upravit zákazníka**: zaškrtávací pole **Centrála**, karta doručovacích adres hlavní jednotky (vždy) a karta poboček (po zaškrtnutí Centrála) s vnořenými adresami u každé pobočky; uložení jedním tlačítkem přes rozšířené API `POST/PUT /api/iml/customers`. Na **detailu** je u poboček jen přehled a odkaz „Spravovat ve formuláři“.
- **Doručovací adresy** se vážou na konkrétní jednotku (`iml_customer_shipping_addresses.customer_id`) – centrála i každá pobočka mají vlastní seznam; v objednávce se vybírá jednotka a její adresy.

### 3.8 Statistiky a historie

- Historie objednávek / poslední datum výroby
- Celkové množství vyrobených kusů
- Průměrná objednávka (za posledních 6–12 měsíců)

---

## 4. Databázové schéma (Prisma)

### 4.1 Tabulka `iml_customers` – Zákazníci

```prisma
model iml_customers {
  id                              Int       @id @default(autoincrement())
  name                            String    @db.VarChar(255)
  email                           String?   @unique @db.VarChar(255)
  phone                           String?   @db.VarChar(50)
  contact_person                   String?   @db.VarChar(255)
  allow_under_over_delivery_percent Decimal? @db.Decimal(5, 2)
  customer_note                   String?   @db.Text
  billing_address                 String?   @db.Text
  shipping_address                String?   @db.Text
  individual_requirements         String?   @db.Text
  city                            String?   @db.VarChar(100)
  postal_code                     String?   @db.VarChar(20)
  country                         String?   @default("Česká republika") @db.VarChar(100)
  created_at                      DateTime  @default(now()) @db.DateTime(0)
  updated_at                      DateTime  @updatedAt @db.DateTime(0)

  iml_products iml_products[]
  iml_orders   iml_orders[]

  @@map("iml_customers")
}
```

### 4.2 Tabulka `iml_products` – Katalog produktů

```prisma
model iml_products {
  id                   Int       @id @default(autoincrement())
  customer_id          Int?
  ig_code             String?   @db.VarChar(100)
  ig_short_name       String?   @db.VarChar(255)
  client_code         String?   @db.VarChar(100)
  client_name         String?   @db.VarChar(255)
  requester           String?   @db.VarChar(255)
  label_shape_code    String?   @db.VarChar(100)
  product_format      String?   @db.VarChar(100)   // odvozený text, např. "45 × 30 mm"
  format_width_mm     Decimal?  @db.Decimal(8, 2)
  format_height_mm    Decimal?  @db.Decimal(8, 2)
  die_cut_tool_code   String?   @db.VarChar(100)
  assembly_code       String?   @db.VarChar(100)
  positions_on_sheet  Int?
  pieces_per_box      Int?
  pieces_per_pallet   Int?
  foil_type           String?   @db.VarChar(255)
  color_coverage      String?   @db.VarChar(255)
  print_note          String?   @db.Text
  image_data          Bytes?    // BLOB – náhled
  pdf_data            Bytes?    // BLOB – tisková data
  has_print_sample    Boolean   @default(false)
  has_print_proof     Boolean   @default(false)
  ean_code            String?   @db.VarChar(50)
  production_notes   String?   @db.Text
  approval_status    String?   @db.VarChar(50)
  approval_date      DateTime? @db.Date
  color_count        Int?
  print_colors_text  String?   @db.VarChar(255)
  label_type         String?   @db.VarChar(20)   // rezana | s_vysekem
  realization_log   String?   @db.Text
  internal_note      String?   @db.Text
  last_edited_by     String?   @db.VarChar(255)
  item_status        String?   @db.VarChar(50)
  print_data_version String?   @db.VarChar(20)
  stock_quantity     Int?
  sku                String?   @unique @db.VarChar(100)
  is_active          Boolean   @default(true)
  custom_data        Json?     @db.Json
  created_at         DateTime  @default(now()) @db.DateTime(0)
  updated_at         DateTime  @updatedAt @db.DateTime(0)

  iml_customers iml_customers? @relation(fields: [customer_id], references: [id], onDelete: SetNull)
  iml_order_items iml_order_items[]

  @@index([customer_id])
  @@index([ig_code])
  @@index([sku])
  @@index([item_status])
  @@map("iml_products")
}
```

### 4.3 Tabulka `iml_orders` – Objednávky

```prisma
model iml_orders {
  id                  Int       @id @default(autoincrement())
  customer_id         Int
  order_number        String    @unique @db.VarChar(50)
  order_date          DateTime  @db.DateTime(0)
  expected_ship_date  DateTime? @db.DateTime(0)
  status              String    @default("nová") @db.VarChar(50)
  total               Decimal?  @db.Decimal(10, 2)
  notes               String?   @db.Text
  custom_data         Json?     @db.Json
  created_at          DateTime  @default(now()) @db.DateTime(0)
  updated_at          DateTime  @updatedAt @db.DateTime(0)

  iml_customers   iml_customers   @relation(fields: [customer_id], references: [id], onDelete: Restrict)
  iml_order_items iml_order_items[]

  @@index([customer_id])
  @@index([order_date])
  @@index([status])
  @@map("iml_orders")
}
```

### 4.4 Tabulka `iml_order_items` – Položky objednávek

```prisma
model iml_order_items {
  id         Int      @id @default(autoincrement())
  order_id   Int
  product_id Int
  quantity   Int
  unit_price Decimal? @db.Decimal(10, 2)
  subtotal   Decimal?  @db.Decimal(10, 2)
  created_at DateTime @default(now()) @db.DateTime(0)

  iml_orders   iml_orders   @relation(fields: [order_id], references: [id], onDelete: Cascade)
  iml_products iml_products @relation(fields: [product_id], references: [id], onDelete: Restrict)

  @@index([order_id])
  @@index([product_id])
  @@map("iml_order_items")
}
```

### 4.5 Tabulka `iml_custom_fields` – Vlastní pole

Uživatelsky definovaná pole pro produkty a objednávky. Hodnoty v `custom_data` (JSON).

```prisma
model iml_custom_fields {
  id         Int      @id @default(autoincrement())
  entity     String   @db.VarChar(50)   // "products" | "orders"
  field_key  String   @db.VarChar(100)
  label      String   @db.VarChar(255)
  field_type String   @default("text") @db.VarChar(20)  // text, number, date, boolean
  sort_order Int      @default(0)
  is_active  Boolean  @default(true)
  created_at DateTime @default(now()) @db.DateTime(0)

  @@unique([entity, field_key])
  @@map("iml_custom_fields")
}
```

---

## 5. Struktura aplikace

### 5.1 Adresářová struktura

```
app/(dashboard)/iml/
├── page.tsx                    # Přehled (dashboard IML)
├── customers/
│   ├── page.tsx                # Seznam zákazníků
│   ├── add/page.tsx            # Přidat zákazníka
│   └── [id]/
│       ├── page.tsx            # Detail zákazníka
│       └── edit/page.tsx       # Editace zákazníka
├── products/
│   ├── page.tsx                # Katalog produktů
│   ├── add/page.tsx            # Přidat produkt
│   └── [id]/
│       ├── page.tsx            # Detail produktu (náhled, PDF)
│       └── edit/page.tsx       # Editace produktu
├── orders/
│   ├── page.tsx                # Seznam objednávek
│   ├── add/page.tsx            # Nová objednávka
│   ├── import/page.tsx         # Import objednávek (CSV/Excel, drag & drop)
│   └── [id]/
│       ├── page.tsx            # Detail objednávky
│       └── edit/page.tsx       # Editace objednávky
├── settings/
│   └── page.tsx                # Nastavení IML – vlastní pole
└── _components/                # Vlastní komponenty (CustomFieldsFormSection, …)

app/api/iml/
├── customers/
│   ├── route.ts                # GET (list), POST (create)
│   └── [id]/route.ts           # GET, PUT, DELETE
├── products/
│   ├── route.ts                # GET (list), POST (create)
│   ├── [id]/route.ts           # GET, PUT, DELETE
│   ├── [id]/image/route.ts      # GET, POST, DELETE obrázek
│   └── [id]/pdf/route.ts       # GET, POST, DELETE PDF
├── orders/
│   ├── route.ts                # GET (list), POST (create)
│   ├── export/route.ts         # GET – export CSV/Excel
│   ├── import/route.ts         # POST – import z CSV/Excel
│   └── [id]/route.ts           # GET, PUT, DELETE
└── custom-fields/
    ├── route.ts                # GET (list), POST (create)
    └── [id]/route.ts           # PUT, DELETE
```

### 5.2 Integrace do layoutu

- `lib/auth-utils.ts` – `iml` v `getLayoutAccess()`
- `app/(dashboard)/layout.tsx` – `iml` v `moduleAccess`
- `components/layout/Sidebar.tsx` – položka IML
- `app/(dashboard)/admin/users/AdminUserForm.tsx` – IML v `AVAILABLE_MODULES`

---

## 6. Funkční specifikace

### 6.1 Zákazníci

- Seznam s filtrem, vyhledáváním, řazením
- Detail – karta zákazníka, seznam produktů a objednávek
- CRUD, export CSV/Excel, import z CSV

### 6.2 Produkty

- Seznam s filtry (zákazník, stav), vyhledávání podle kódu/názvu
- Detail – náhled obrázku, PDF, všechny sekce z požadavků
- CRUD – včetně uploadu obrázku (JPG, PNG, WebP) a PDF
- Sekce: Identifikace, Výseky a montáže, Materiály a tisk, Schvalování, Metadata, Vlastní pole

### 6.3 Objednávky

- Seznam – filtrování podle zákazníka, data, stavu
- Detail – položky objednávky (produkt, množství, cena)
- CRUD – vytvoření objednávky s položkami
- Stavy: nová, potvrzená, odeslaná, dokončená, zrušená

### 6.4 Reporty a dashboard

Na hlavní stránce IML (`/iml`):

- Počty zákazníků, produktů, objednávek
- Objednávky ke zpracování (nové + potvrzené)
- Report za 12 měsíců (počet objednávek, celková hodnota)
- Objednávky podle stavu
- Top zákazníci podle počtu objednávek
- Produkty podle stavu
- Poslední objednávky

---

## 7. Export a import

### 7.1 Export

- **Zákazníci:** `/api/iml/customers/export?format=csv` nebo `?format=xlsx`
- **Produkty:** `/api/iml/products/export?format=csv` nebo `?format=xlsx` (respektuje filtry)
- **Objednávky:** `/api/iml/orders/export?format=csv` nebo `?format=xlsx`

### 7.2 Import zákazníků (`/iml/customers/import`)

- Formát: CSV
- Povinné pole: `name`
- Mapování: name, email, phone, contact_person, city, postal_code, country, billing_address, shipping_address, individual_requirements, customer_note, allow_under_over_delivery_percent

### 7.3 Import produktů (`/iml/products/import`)

**Složka nebo ZIP (IMLEXport) – doporučený postup**

- **Složka** (doporučeno): výběr celé složky exportu v prohlížeči – bez nutnosti vytvářet ZIP; **bez celkového limitu** (soubory se při importu nahrávají postupně po dávkách cca 100 MB)
- **ZIP** (volitelně): archiv se stejnou strukturou; max. **500 MB** (jeden požadavek)
- Kořen: `products.csv` (nebo první `.csv`) + rekurzivní podsložky se soubory
- **Rychlý náhled (složka):** při mapování a konfliktech se nahraje jen `products.csv` + seznam cest souborů (`previewMode=light`); PDF a obrázky až při **Spustit import**
- Cesty ze složky se normalizují (společný kořen např. `IMLEXport/` se odstraní, aby odpovídaly struktuře ZIP)
- API: `POST /api/iml/products/import/preview` (náhled, konflikty); u složky `POST /api/iml/products/import/session` → `POST /api/iml/products/import/batch` (opakovaně) → `POST /api/iml/products/import/execute` (se `sessionId`); u ZIP jeden `POST /api/iml/products/import/execute` s archivem
- Automatické mapování sloupců z IMLEXportu: `code` → `ig_code`, `name` → `client_name`, `contractor` → `customer_name`, `material` / `note` → `production_notes`, `print` → `print_note`
- **Konflikty** existujícího `ig_code`: před importem náhled; akce **přepsat** (metadata z CSV) nebo **přeskočit** (metadata beze změny, soubory z ZIP se k produktu přiřadí)
- **Pojmenování souborů v ZIP** (bez ohledu na podsložku):
  - **Tisková data:** PDF, název začíná kódem produktu (`04-03-002-…pdf`) → `iml_product_files` (verzované PDF, max 50 MB)
  - **Náhled:** JPG/PNG/WebP/GIF, nebo název začíná `softproof` / `softproof-` / `softproof_` (volitelně PDF softproof → JPEG na serveru, pokud je nainstalován `canvas`) → `iml_products.image_data` (max 5 MB)
- Ignorováno: `products.csv`, skryté soubory, nepodporované přípony; soubory bez rozpoznaného kódu se v reportu označí

**CSV / Excel bez ZIP (zpětná kompatibilita)**

- `POST /api/iml/products/import` – pouze řádky produktů, bez příloh
- Povinné mapování: `ig_code` nebo `client_name` nebo `ig_short_name`
- Mapování: ig_code, ig_short_name, client_code, client_name, sku, customer_name, requester, label_shape_code, product_format, format_width_mm, format_height_mm, die_cut_tool_code, assembly_code, positions_on_sheet, pieces_per_box, pieces_per_pallet, foil_type, color_coverage, ean_code, item_status, approval_status, approval_date, color_count, print_colors_text, label_type, has_print_sample, has_print_proof

### 7.4 Import objednávek (`/iml/orders/import`)

- Formáty: CSV, Excel (.xlsx, .xls)
- Náhled souboru před importem
- Drag & drop mapování sloupců
- Povinná pole: `order_number`, `customer_name`, `order_date`, `product_identifier` (ig_code, sku nebo client_name), `quantity`
- Volitelná: `status`, `notes`, `unit_price`
- Formát: každý řádek = jedna položka; řádky se stejným číslem, zákazníkem a datem se sloučí do jedné objednávky

---

## 8. Vlastní pole

Uživatelé mohou rozšířit databázi o vlastní pole u produktů a objednávek bez změny kódu.

### 8.1 Nastavení (`/iml/settings`)

- Přidání pole: klíč (např. `dodaci_cas`), popisek, typ, entita (produkty/objednávky)
- Úprava a mazání existujících polí
- Pořadí zobrazení (sort_order)

### 8.2 Typy polí

| Typ | Popis |
|-----|-------|
| text | Jednořádkový text |
| number | Číslo |
| date | Datum |
| boolean | Ano/ne (checkbox) |

### 8.3 Zobrazení

- Formuláře přidání/editace produktu a objednávky
- Detail produktu a objednávky

### 8.4 Migrace vlastních polí

- Sloupec `custom_data` (JSON) v `iml_products` a `iml_orders`
- Tabulka `iml_custom_fields`
- Spusťte: `npx prisma db execute --file prisma/migrations/add_iml_custom_fields.sql`
- Pokud sloupce `custom_data` již existují, spusťte jen `CREATE TABLE IF NOT EXISTS iml_custom_fields ...`

---

## 9. API – přehled endpointů

| Endpoint | Metody | Popis |
|----------|--------|-------|
| `/api/iml/customers` | GET, POST | Seznam, vytvoření |
| `/api/iml/customers/[id]` | GET, PUT, DELETE | Detail, úprava, smazání |
| `/api/iml/customers/export` | GET | Export CSV/Excel |
| `/api/iml/customers/import` | POST | Import z CSV |
| `/api/iml/products` | GET, POST | Seznam, vytvoření |
| `/api/iml/products/[id]` | GET, PUT, DELETE | Detail, úprava, smazání |
| `/api/iml/products/[id]/image` | GET, POST, DELETE | Obrázek produktu |
| `/api/iml/products/[id]/pdf` | GET, POST, DELETE | PDF produktu |
| `/api/iml/products/export` | GET | Export CSV/Excel |
| `/api/iml/products/import` | POST | Import z CSV/Excel (bez příloh) |
| `/api/iml/products/import/preview` | POST | Náhled importu (light preview ze složky nebo celý ZIP) |
| `/api/iml/products/import/session` | POST / DELETE | Relace pro postupné nahrávání složky |
| `/api/iml/products/import/batch` | POST | Jedna dávka souborů do relace (max. cca 100 MB) |
| `/api/iml/products/import/execute` | POST | Provedení importu (ZIP v těle, nebo `sessionId` po dávkách) |
| `/api/iml/orders` | GET, POST | Seznam, vytvoření |
| `/api/iml/orders/[id]` | GET, PUT, DELETE | Detail, úprava, smazání |
| `/api/iml/orders/export` | GET | Export CSV/Excel |
| `/api/iml/orders/import` | POST | Import z CSV/Excel |
| `/api/iml/custom-fields` | GET, POST | Seznam vlastních polí (`?entity=products|orders`), vytvoření |
| `/api/iml/custom-fields/[id]` | PUT, DELETE | Úprava, smazání vlastního pole |

---

## 10. Oprávnění

- Modul: `iml`
- Úrovně: `read`, `write`, `admin`
- Export vyžaduje `read`
- Import a CRUD vyžaduje `write`
- Nastavení vlastních polí: `write` nebo `admin`

---

## 11. Technické detaily

### 11.1 Obrázky a PDF

- Ukládání do `Bytes` (Prisma) – BLOB
- API: `/api/iml/products/[id]/image` a `/api/iml/products/[id]/pdf`
- **Verzované PDF:** tabulka `iml_product_files` (více verzí na produkt, primární verze, historie na záložce „Tisková data“). Endpoint `/api/iml/products/[id]/pdf` čte primární verzi z této tabulky a při absenci verzí padá na legacy `iml_products.pdf_data`.
- **Příznak „má PDF“ v UI:** `GET /api/iml/products` a `GET /api/iml/products/[id]` vrací `has_pdf: true`, pokud je neprázdný buď legacy `pdf_data`, nebo aspoň jeden řádek v `iml_product_files` s neprázdným `pdf_data` (sloupec PDF v katalogu, nástrojová lišta detailu, stav v editaci). Pomocná logika: `lib/iml-product-pdf-flag.ts`.
- Validace MIME typu při uploadu

### 11.2 Migrace z NewIML (PHP)

- `customers` → `iml_customers`
- `products` → `iml_products` (image_path/pdf_path → image_data/pdf_data)
- `orders` → `iml_orders`, `order_items` → `iml_order_items`

### 11.3 Související moduly

- **Plánování výroby** – potenciální propojení: objednávka → blok výroby
- **Kontakty** – `iml_customers` je samostatná evidence

---

## 12. Fáze implementace

| Fáze | Stav | Obsah |
|------|------|-------|
| 1 – Základ (MVP) | ✅ | Prisma schéma, API, stránky, CRUD, integrace |
| 2 – Rozšíření | ✅ | Upload obrázků/PDF, detailní karty, filtry, statistiky |
| 3 – Pokročilé | ✅ | Export/import CSV/Excel, reporty, dashboard, import objednávek s mapováním |
| 4 – Vlastní pole | ✅ | Tabulka `iml_custom_fields`, `custom_data`, `/iml/settings`, API |

---

## 13. Původní specifikace (NewIML – zkráceno)

Modul IML vychází z původní aplikace NewIML (PHP).

- **Tabulky:** customers, products, orders, order_items
- **Obrázky a PDF:** ukládání do BLOB (BLOB v Next.js: image_data, pdf_data)
- **Vlastní pole:** místo dynamického přidávání sloupců se používá JSON sloupec `custom_data` a tabulka definic `iml_custom_fields`
