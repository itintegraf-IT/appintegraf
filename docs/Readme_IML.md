# NewIML - Správa zákazníků, objednávek a produktů

Webová aplikace pro správu zákazníků, jejich objednávek a katalogu produktů s možností dynamického přidávání sloupců do tabulek.

## Struktura databáze

### Tabulky

#### 1. `customers` - Zákazníci
Základní informace o zákaznících.

**Základní sloupce:**
- `id` - Primární klíč (AUTO_INCREMENT)
- `name` - Jméno zákazníka (VARCHAR 255)
- `email` - Email (VARCHAR 255, UNIQUE)
- `phone` - Telefon (VARCHAR 50)
- `address` - Adresa (TEXT)
- `city` - Město (VARCHAR 100)
- `postal_code` - PSČ (VARCHAR 20)
- `country` - Země (VARCHAR 100, default: 'Česká republika')
- `contact_person` - Kontaktní osoba (VARCHAR 255)
- `allow_under_over_delivery_percent` - Povolená procentuální odchylka pod-/nadnákladu (DECIMAL 5,2)
- `customer_note` - Poznámka ke klientovi (TEXT)
- `billing_address` - Fakturační adresa (TEXT)
- `shipping_address` - Doručovací adresa (TEXT)
- `individual_requirements` - Individuální požadavky (např. zákaz podnákladu, specifický způsob balení) (TEXT)
- `created_at` - Datum vytvoření (DATETIME) - automaticky se nastaví při vložení záznamu
- `updated_at` - Datum aktualizace (DATETIME) - automaticky se aktualizuje při každé změně záznamu

**Možné rozšíření přes webové rozhraní:**
- Dodatečné kontaktní údaje
- Poznámky
- Kategorie zákazníků
- atd.

---

#### 2. `products` - Katalog produktů
Katalog produktů s popisem, parametry, fotografiemi a PDF dokumenty.

**Základní sloupce:**
- `id` - Primární klíč (AUTO_INCREMENT)
- `name` - Název produktu (VARCHAR 255)
- `description` - Popis produktu (TEXT)
- `price` - Cena (DECIMAL 10,2)
- `sku` - SKU kód (VARCHAR 100) - unikátní identifikační kód produktu
- `ig_code` - Kód produktu (IG) (VARCHAR 100)
- `ig_short_name` - Zkrácený název (IG) (VARCHAR 255)
- `client_code` - Kód produktu u klienta (VARCHAR 100)
- `client_name` - Originální název produktu u klienta (VARCHAR 255)
- `requester` - Zadavatel (VARCHAR 255)
- `customer_id` - Hlavní zákazník/klient pro tento produkt (INT 11, FOREIGN KEY -> customers.id)
- `label_shape_code` - Kódové označení tvaru etikety (VARCHAR 100)
- `product_format` - Rozměr/formát produktu (VARCHAR 100)
- `die_cut_tool_code` - Kód výsekového nástroje (VARCHAR 100)
- `assembly_code` - Kód montáže (VARCHAR 100)
- `positions_on_sheet` - Počet pozic na tiskovém archu (INT 11)
- `pieces_per_box` - Počet kusů v krabici (INT 11)
- `pieces_per_pallet` - Počet kusů/krabic na paletě (INT 11)
- `foil_type` - Název/druh fólie (potiskovaného materiálu) (VARCHAR 255)
- `color_coverage` - Barevnost a procentuální pokrytí (VARCHAR 255)
- `print_note` - Poznámka k tisku (TEXT)
- `image_path` - Náhled / obrázek produktu (BLOB) - obrázky se ukládají přímo do databáze (JPG, PNG, TIFF, GIF, WebP)
- `pdf_path` - Tisková data / PDF soubor produktu (BLOB) - PDF soubory se ukládají přímo do databáze
- `has_print_sample` - Máme vzor min. tisku/nátisk (BOOLEAN)
- `ean_code` - EAN kód (VARCHAR 50)
- `production_notes` - Výrobní poznámky / doporučení (TEXT)
- `approval_status` - Stav schválení (VARCHAR 50)
- `realization_log` - LOG realizací (četnost a data) (TEXT)
- `internal_note` - Volná interní poznámka (TEXT)
- `last_edited_by` - Kdo naposledy editoval (VARCHAR 255)
- `item_status` - Stav položky (aktivní/archivní/testovací/zablokovaná) (VARCHAR 50)
- `print_data_version` - Verze tiskových dat (např. v1, v2…) (VARCHAR 20)
- `stock_quantity` - Skladem množství (INT 11)
- `is_active` - Aktivní produkt (BOOLEAN)
- `created_at` - Datum vytvoření (DATETIME) - automaticky se nastaví při vložení záznamu
- `updated_at` - Datum aktualizace (DATETIME) - automaticky se aktualizuje při každé změně záznamu

**Možné rozšíření přes webové rozhraní:**
- Parametry produktů (param1, param2, param3, ...)
- Dodatečné obrázky
- Kategorie produktů
- Výrobce
- atd.

---

#### 3. `orders` - Objednávky
Objednávky zákazníků.

**Základní sloupce:**
- `id` - Primární klíč (AUTO_INCREMENT)
- `customer_id` - ID zákazníka (INT 11, FOREIGN KEY -> customers.id)
- `order_number` - Číslo objednávky (VARCHAR 50, UNIQUE)
- `order_date` - Datum objednávky (DATETIME)
- `status` - Stav objednávky (VARCHAR 50, default: 'nová')
  - Možné hodnoty: nová, potvrzená, odeslaná, dokončená, zrušená
- `total` - Celková cena (DECIMAL 10,2)
- `notes` - Poznámky k objednávce (TEXT)
- `created_at` - Datum vytvoření (DATETIME) - automaticky se nastaví při vložení záznamu
- `updated_at` - Datum aktualizace (DATETIME) - automaticky se aktualizuje při každé změně záznamu

**Možné rozšíření přes webové rozhraní:**
- Dodatečné informace o dodání
- Fakturační údaje
- atd.

---

#### 4. `order_items` - Položky objednávky
Vztah mezi objednávkami a produkty (many-to-many).

**Základní sloupce:**
- `id` - Primární klíč (AUTO_INCREMENT)
- `order_id` - ID objednávky (INT 11, FOREIGN KEY -> orders.id)
- `product_id` - ID produktu (INT 11, FOREIGN KEY -> products.id)
- `quantity` - Množství (INT 11)
- `unit_price` - Jednotková cena v době objednávky (DECIMAL 10,2)
- `subtotal` - Mezisoučet (DECIMAL 10,2)
- `created_at` - Datum vytvoření (DATETIME)

**Možné rozšíření přes webové rozhraní:**
- Slevy
- Dodatečné poznámky k položce
- atd.

---

## Vztahy mezi tabulkami

```
customers (1) ──< (N) orders
orders (1) ──< (N) order_items
products (1) ──< (N) order_items
```

## Instalace

1. **Vytvoření databáze a tabulek:**
   ```sql
   CREATE DATABASE IF NOT EXISTS NewIML CHARACTER SET utf8mb4 COLLATE utf8mb4_czech_ci;
   USE NewIML;
   ```
   Poté spusťte soubor `schema.sql` v MySQL/MariaDB.

2. **Konfigurace:**
   Upravte soubor `config.php` podle vašeho nastavení databáze:
   - `$DB_HOST` - adresa databázového serveru
   - `$DB_USER` - uživatelské jméno
   - `$DB_PASS` - heslo

3. **Webové rozhraní:**
   Po vytvoření základní struktury bude možné přidávat další sloupce přes webové rozhraní.

4. **Migrace databáze (volitelné):**
   Pokud chcete použít nové funkce pro ukládání obrázků a PDF přímo do databáze, spusťte migrační skripty:
   ```sql
   -- Migrace obrázků z VARCHAR na LONGBLOB
   SOURCE migrate_image_to_blob.sql;
   
   -- Migrace PDF z VARCHAR na LONGBLOB
   SOURCE migrate_pdf_to_blob.sql;
   
   -- Oprava AUTO_INCREMENT pro sloupec id (pokud chybí)
   SOURCE fix_auto_increment.sql;
   
   -- Nastavení automatických timestampů
   SOURCE fix_timestamps.sql;
   ```

## Funkce aplikace

### Ukládání obrázků a PDF
- **Obrázky** (JPG, PNG, TIFF, GIF, WebP) se ukládají přímo do databáze jako BLOB
- **PDF soubory** se ukládají přímo do databáze jako BLOB
- Obrázky se zobrazují jako náhledy v tabulkovém i formulářovém zobrazení
- PDF soubory se zobrazují jako tlačítko "Zobrazit PDF" (otevře se v novém okně)
- Při editaci lze obrázky/PDF smazat pomocí checkboxu

### Automatické timestampy
- **`created_at`** - automaticky se nastaví při vložení záznamu a **nemění se** při úpravách
- **`updated_at`** - automaticky se nastaví při vložení záznamu a **automaticky se aktualizuje** při každé změně záznamu
- Tyto sloupce se nezobrazují ve formulářích (jsou plně automatické)

### Automatické ID
- Sloupec `id` je automaticky generován pomocí `AUTO_INCREMENT`
- Při přidávání záznamu není potřeba ID zadávat

## Povolené datové typy pro přidávání sloupců

- **INT** - Celé číslo (s délkou)
- **VARCHAR** - Textový řetězec (s délkou)
- **TEXT** - Dlouhý text
- **DECIMAL** - Desetinné číslo (formát: precision,scale, např. 10,2)
- **DATE** - Datum
- **DATETIME** - Datum a čas
- **BOOLEAN** - Pravdivostní hodnota
- **TINYINT** - Malé celé číslo

## Bezpečnost

- Pouze tabulky v whitelistu (`$ALLOWED_TABLES`) mohou být upravovány
- Validace názvů sloupců (pouze alfanumerické znaky a podtržítko)
- Whitelist povolených datových typů
- PDO připojení s prepared statements
- Validace uploadovaných souborů (kontrola MIME typu pro obrázky a PDF)

## Migrační skripty

Aplikace obsahuje několik migračních skriptů pro aktualizaci databázové struktury:

1. **`migrate_image_to_blob.sql`** - Změna sloupce `image_path` z VARCHAR na LONGBLOB pro ukládání obrázků přímo do databáze
2. **`migrate_pdf_to_blob.sql`** - Změna sloupce `pdf_path` z VARCHAR na LONGBLOB pro ukládání PDF souborů přímo do databáze
3. **`fix_auto_increment.sql`** - Přidání AUTO_INCREMENT k sloupci `id` v tabulce `products` (pokud chybí)
4. **`fix_timestamps.sql`** - Nastavení automatických timestampů pro `created_at` a `updated_at`

## Poznámky

- **SKU kód** (`sku` nebo `kodProduktu`) - unikátní identifikační kód produktu používaný pro skladové hospodářství a objednávky
- **BLOB sloupce** - automaticky se rozpoznávají podle názvu sloupce:
  - Obrázky: sloupce obsahující "image", "foto", "img" nebo "obrazek"
  - PDF: sloupce obsahující "pdf"
- **Automatické timestampy** - sloupce `created_at` a `updated_at` se automaticky spravují, není potřeba je vyplňovat

