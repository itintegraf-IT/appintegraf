# Modul IML – Kompletní dokumentace

Modul IML slouží ke správě zákazníků, katalogu produktů a objednávek v rámci aplikace INTEGRAF. Tento dokument slučuje veškerou dokumentaci modulu z původních souborů `MODUL_IML.md`, `NAVRH_MODULU_IML.md`, `Readme_IML.md` a `pozadavky_IML.txt`.

---

## 1. Přehled a rychlý start

### 1.1 Přehled stránek

| Funkce | Cesta | Popis |
|--------|-------|-------|
| Dashboard IML | `/iml` | Přehled, statistiky, reporty, poslední objednávky |
| Zákazníci | `/iml/customers` | Evidence zákazníků, CRUD, export, import |
| Produkty | `/iml/products` | Katalog produktů, obrázky, PDF, export, import |
| Objednávky | `/iml/orders` | Evidence objednávek, položky, export, import |
| Nastavení | `/iml/settings` | Vlastní pole, správa rozšíření databáze |

### 1.2 Rychlý start

1. **Oprávnění** – v administraci uživatelů přiřaďte modul IML a úroveň (read/write/admin).
2. **Vlastní pole** – v Nastavení IML definujte vlastní pole pro produkty nebo objednávky.
3. **Import** – CSV/Excel lze importovat na stránkách zákazníků, produktů a objednávek.

### 1.3 Shrnutí modulu

| Položka | Hodnota |
|---------|---------|
| **Modul** | IML |
| **Cesta** | `/iml` |
| **Tabulky** | `iml_customers`, `iml_products`, `iml_orders`, `iml_order_items`, `iml_custom_fields` |
| **Oprávnění** | `iml` (read/write/admin) |
| **Technologie** | Next.js App Router, Prisma, stávající UI komponenty |

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

### 3.2 Výseky a montáže

- Kódové označení tvaru etikety, Rozměr/formát produktu, Kód výsekového nástroje, Kód montáže
- Počet pozic na Tiskovém Archu, Počet kusů v krabici, Počet KS/krabic na paletě

### 3.3 Materiály a tisk

- Název/druh fólie, Barevnost + procentuální pokrytí, Poznámka k tisku, Tisková data (PDF)
- Vzor min tisku/nátisk, EAN kód, Výrobní poznámky

### 3.4 Schvalování a historie

- Stav schválení, LOG realizací, Volná poznámka

### 3.5 Metadata produktu

- Datum založení, Datum poslední aktualizace, Kdo naposledy editoval
- Stav položky (aktivní/archivní/testovací/zablokovaná), Verze tiskových dat, Skladová zásoba

### 3.6 Sekce Klient (zákazník)

- Název zákazníka, Kontaktní osoba, E-mail
- Procentuální možnost expedovat pod-/nadnáklad, Poznámka
- Fakturační adresa, Doručovací adresa, Individuální požadavky

### 3.7 Statistiky a historie

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
  product_format      String?   @db.VarChar(100)
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
  ean_code            String?   @db.VarChar(50)
  production_notes   String?   @db.Text
  approval_status    String?   @db.VarChar(50)
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
  id           Int       @id @default(autoincrement())
  customer_id  Int
  order_number String    @unique @db.VarChar(50)
  order_date   DateTime  @db.DateTime(0)
  status       String    @default("nová") @db.VarChar(50)
  total        Decimal?  @db.Decimal(10, 2)
  notes        String?   @db.Text
  custom_data  Json?     @db.Json
  created_at   DateTime  @default(now()) @db.DateTime(0)
  updated_at   DateTime  @updatedAt @db.DateTime(0)

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

- Formát: CSV
- Povinné: `ig_code` nebo `client_name` nebo `ig_short_name`
- Mapování: ig_code, ig_short_name, client_code, client_name, sku, customer_name, requester, label_shape_code, product_format, die_cut_tool_code, assembly_code, positions_on_sheet, pieces_per_box, pieces_per_pallet, foil_type, color_coverage, ean_code, item_status, approval_status, has_print_sample

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
| `/api/iml/products/import` | POST | Import z CSV |
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
