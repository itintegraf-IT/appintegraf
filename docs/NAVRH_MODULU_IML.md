# Návrh modulu IML – Integrace do APPIntegraf-NEXT

Návrh nového modulu **IML** (správa zákazníků, produktů a objednávek) pro aplikaci INTEGRAF na základě dokumentů `pozadavky_IML.txt` a `Readme_IML.md`.

---

## 1. Shrnutí účelu modulu

Modul IML poskytuje:
- **Evidence zákazníků (klientů)** – kontakty, adresy, individuální požadavky, % odchylka pod-/nadnákladu
- **Katalog produktů** – identifikace, výseky, montáže, materiály, tisk, schvalování, historie
- **Objednávky** – vazba zákazník ↔ produkty, množství, ceny, stavy
- **Statistiky** – historie objednávek, poslední výroba, průměrná objednávka

---

## 2. Databázové schéma (Prisma)

### 2.1 Tabulka `iml_customers` – Zákazníci

Mapuje sekci **Klient** z požadavků a tabulku `customers` z Readme_IML.

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
  individual_requirements        String?   @db.Text
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

### 2.2 Tabulka `iml_products` – Katalog produktů

Mapuje požadavky z `pozadavky_IML.txt` a tabulku `products` z Readme_IML.

```prisma
model iml_products {
  id                  Int       @id @default(autoincrement())
  customer_id         Int?
  ig_code             String?   @db.VarChar(100)
  ig_short_name       String?   @db.VarChar(255)
  client_code         String?   @db.VarChar(100)
  client_name         String?   @db.VarChar(255)
  requester           String?   @db.VarChar(255)
  label_shape_code    String?   @db.VarChar(100)
  product_format      String?   @db.VarChar(100)
  die_cut_tool_code   String?   @db.VarChar(100)
  assembly_code      String?   @db.VarChar(100)
  positions_on_sheet  Int?
  pieces_per_box     Int?
  pieces_per_pallet  Int?
  foil_type          String?   @db.VarChar(255)
  color_coverage     String?   @db.VarChar(255)
  print_note         String?   @db.Text
  image_data         Bytes?    // BLOB – náhled
  pdf_data           Bytes?    // BLOB – tisková data
  has_print_sample   Boolean   @default(false)
  ean_code           String?   @db.VarChar(50)
  production_notes   String?   @db.Text
  approval_status    String?   @db.VarChar(50)
  realization_log   String?   @db.Text
  internal_note     String?   @db.Text
  last_edited_by    String?   @db.VarChar(255)
  item_status       String?   @db.VarChar(50)  // aktivní/archivní/testovací/zablokovaná
  print_data_version String?  @db.VarChar(20)
  stock_quantity    Int?
  sku               String?   @unique @db.VarChar(100)
  is_active         Boolean   @default(true)
  created_at        DateTime  @default(now()) @db.DateTime(0)
  updated_at        DateTime  @updatedAt @db.DateTime(0)

  iml_customers iml_customers? @relation(fields: [customer_id], references: [id], onDelete: SetNull)
  iml_order_items iml_order_items[]

  @@index([customer_id])
  @@index([ig_code])
  @@index([sku])
  @@index([item_status])
  @@map("iml_products")
}
```

### 2.3 Tabulka `iml_orders` – Objednávky

```prisma
model iml_orders {
  id           Int       @id @default(autoincrement())
  customer_id  Int
  order_number String    @unique @db.VarChar(50)
  order_date   DateTime  @db.DateTime(0)
  status       String    @default("nová") @db.VarChar(50)
  total        Decimal?  @db.Decimal(10, 2)
  notes        String?   @db.Text
  created_at   DateTime  @default(now()) @db.DateTime(0)
  updated_at   DateTime  @updatedAt @db.DateTime(0)

  iml_customers iml_customers @relation(fields: [customer_id], references: [id], onDelete: Restrict)
  iml_order_items iml_order_items[]

  @@index([customer_id])
  @@index([order_date])
  @@index([status])
  @@map("iml_orders")
}
```

### 2.4 Tabulka `iml_order_items` – Položky objednávek

```prisma
model iml_order_items {
  id         Int      @id @default(autoincrement())
  order_id   Int
  product_id Int
  quantity   Int
  unit_price Decimal? @db.Decimal(10, 2)
  subtotal   Decimal? @db.Decimal(10, 2)
  created_at DateTime @default(now()) @db.DateTime(0)

  iml_orders   iml_orders   @relation(fields: [order_id], references: [id], onDelete: Cascade)
  iml_products iml_products @relation(fields: [product_id], references: [id], onDelete: Restrict)

  @@index([order_id])
  @@index([product_id])
  @@map("iml_order_items")
}
```

### 2.5 Volitelně: `iml_customer_stats` – Statistiky zákazníků

Pro „Historie objednávek / poslední datum výroby / celkové množství / průměrná objednávka“ lze:
- buď počítat dynamicky z `iml_orders` a `iml_order_items`,
- nebo přidat materializovanou tabulku pro rychlejší výpočty.

**Doporučení:** Začít s dynamickým výpočtem, případně později přidat cache/stats tabulku.

---

## 3. Struktura modulu v aplikaci

### 3.1 Adresářová struktura

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
└── orders/
    ├── page.tsx                # Seznam objednávek
    ├── add/page.tsx            # Nová objednávka
    ├── import/page.tsx        # Import objednávek (CSV/Excel, drag & drop mapování)
    └── [id]/
        ├── page.tsx            # Detail objednávky
        └── edit/page.tsx       # Editace objednávky

app/api/iml/
├── customers/
│   ├── route.ts                # GET (list), POST (create)
│   └── [id]/route.ts           # GET, PUT, DELETE
├── products/
│   ├── route.ts                # GET (list), POST (create)
│   ├── [id]/route.ts           # GET, PUT, DELETE
│   └── [id]/image/route.ts     # GET obrázek
│   └── [id]/pdf/route.ts       # GET PDF
└── orders/
    ├── route.ts                # GET (list), POST (create)
    ├── export/route.ts         # GET – export CSV/Excel
    ├── import/route.ts         # POST – import z CSV/Excel
    └── [id]/route.ts           # GET, PUT, DELETE
```

### 3.2 Integrace do layoutu a menu

**Soubory k úpravě:**

| Soubor | Změna |
|--------|-------|
| `lib/auth-utils.ts` | Přidat `iml` do `getLayoutAccess()` |
| `app/(dashboard)/layout.tsx` | Přidat `iml` do `moduleAccess` |
| `components/layout/Sidebar.tsx` | Přidat položku `{ href: "/iml", icon: Package, label: "IML", module: "iml" }` |
| `app/(dashboard)/page.tsx` | Přidat IML do `modules` a `quickActions` |

### 3.3 Oprávnění

- Modul: `iml`
- Úrovně: `read`, `write`, `admin` (stejně jako u ostatních modulů)
- Role v `user_roles.module_access` nebo `roles.permissions`: `{ "iml": "read" }` / `{ "iml": "write" }` / `{ "iml": "admin" }`

---

## 4. Funkční specifikace

### 4.1 Zákazníci (iml_customers)

- **Seznam** – tabulka s filtrem, vyhledáváním, řazením
- **Detail** – karta zákazníka, seznam jeho produktů a objednávek
- **CRUD** – přidání, úprava, (soft) delete
- **Export** – CSV/Excel (volitelně)

### 4.2 Produkty (iml_products)

- **Seznam** – tabulka s filtry (zákazník, stav, schválení), vyhledávání podle kódu/názvu
- **Detail** – náhled obrázku, tlačítko „Zobrazit PDF“, všechny sekce z požadavků
- **CRUD** – včetně uploadu obrázku (JPG, PNG, WebP) a PDF
- **Sekce v detailu/editaci:**
  - Identifikace produktu
  - Výseky a montáže
  - Materiály a tisk
  - Schvalování a historie
  - Metadata (datum založení, kdo editoval, verze, sklad)

### 4.3 Objednávky (iml_orders)

- **Seznam** – filtrování podle zákazníka, data, stavu
- **Detail** – položky objednávky (produkt, množství, cena)
- **CRUD** – vytvoření objednávky s položkami (výběr produktů, množství)
- **Stavy:** nová, potvrzená, odeslaná, dokončená, zrušená

### 4.4 Statistiky (volitelně)

- Na kartě zákazníka: poslední objednávka, celkové množství, průměrná objednávka (6–12 měsíců)
- Na dashboardu IML: přehled aktivních produktů, objednávky ke zpracování

---

## 5. Technické detaily

### 5.1 Obrázky a PDF

- **Obrázky:** ukládání do `Bytes` (Prisma) – ekvivalent BLOB
- **PDF:** stejně
- **API pro streamování:** `/api/iml/products/[id]/image` a `/api/iml/products/[id]/pdf` vrací `Response` s `Content-Type` a binárními daty
- **Validace:** kontrola MIME typu při uploadu (obrázky: image/*, PDF: application/pdf)
- **Velikost:** zvážit limit (např. 5 MB obrázek, 20 MB PDF) – konfigurovatelné

### 5.2 Migrace z NewIML (PHP)

Pokud existuje databáze NewIML:
- Tabulky `customers` → `iml_customers` (přejmenování sloupců podle Prisma konvence)
- Tabulky `products` → `iml_products` (image_path/pdf_path BLOB → image_data/pdf_data)
- Tabulky `orders` → `iml_orders`, `order_items` → `iml_order_items`
- Migrační skript (SQL nebo Prisma migrate) pro přenos dat

### 5.3 Související moduly

- **Plánování výroby** (`planovani`) – potenciální propojení: objednávka → blok výroby (budoucí rozšíření)
- **Kontakty** – `iml_customers` je samostatná evidence; propojení na `users` nebo `departments` není v požadavcích, lze doplnit později

---

## 6. Fáze implementace

### Fáze 1 – Základ (MVP)
1. Prisma schéma + migrace
2. API routes pro customers, products, orders
3. Stránky: seznam zákazníků, produktů, objednávek
4. CRUD formuláře (bez uploadu obrázků/PDF)
5. Integrace do menu a oprávnění

### Fáze 2 – Rozšíření ✅ (implementováno)
1. Upload a zobrazení obrázků a PDF u produktů – API `/api/iml/products/[id]/image`, `/api/iml/products/[id]/pdf` (GET, POST, DELETE)
2. Detailní karty s všemi sekcemi z požadavků
3. Filtry, vyhledávání, řazení – produkty (zákazník, stav), objednávky (zákazník, stav)
4. Statistiky na kartě zákazníka – poslední objednávka, celkem objednávek, celkové množství, průměrná objednávka (12 m)

### Fáze 3 – Pokročilé ✅ (implementováno)
1. Export (CSV/Excel) – zákazníci, produkty, objednávky
2. Import zákazníků/produktů z CSV
3. Propojení s plánováním výroby (volitelně)
4. Reporty a dashboard IML – objednávky podle stavu, top zákazníci, produkty podle stavu, report za 12 měsíců
5. Import objednávek z CSV/Excel – náhled souboru, drag & drop mapování sloupců

---

## 7. Shrnutí

| Položka | Hodnota |
|---------|---------|
| **Modul** | IML |
| **Cesta** | `/iml` |
| **Tabulky** | `iml_customers`, `iml_products`, `iml_orders`, `iml_order_items` |
| **Oprávnění** | `iml` (read/write/admin) |
| **Technologie** | Next.js App Router, Prisma, stávající UI komponenty |

Návrh respektuje požadavky z `pozadavky_IML.txt` a strukturu databáze z `Readme_IML.md`, přizpůsobenou konvencím projektu APPIntegraf-NEXT (Prisma, oprávnění, layout).
