# Modul IML – Zákazníci, produkty a objednávky

Modul IML slouží ke správě zákazníků, katalogu produktů a objednávek v rámci aplikace INTEGRAF.

## Přehled

| Funkce | Cesta | Popis |
|--------|-------|-------|
| Dashboard IML | `/iml` | Přehled, statistiky, reporty, poslední objednávky |
| Zákazníci | `/iml/customers` | Evidence zákazníků, CRUD, export, import |
| Produkty | `/iml/products` | Katalog produktů, obrázky, PDF, export, import |
| Objednávky | `/iml/orders` | Evidence objednávek, položky, export, import |

## Export

Export do CSV a Excel je dostupný na stránkách zákazníků, produktů a objednávek.

- **Zákazníci:** `/api/iml/customers/export?format=csv` nebo `?format=xlsx`
- **Produkty:** `/api/iml/products/export?format=csv` nebo `?format=xlsx` (respektuje filtry)
- **Objednávky:** `/api/iml/orders/export?format=csv` nebo `?format=xlsx`

## Import

### Zákazníci (`/iml/customers/import`)

- Formát: CSV
- Povinné pole: `name`
- Mapování sloupců: name, email, phone, contact_person, city, postal_code, country, billing_address, shipping_address, individual_requirements, customer_note, allow_under_over_delivery_percent

### Produkty (`/iml/products/import`)

- Formát: CSV
- Povinné: `ig_code` nebo `client_name` nebo `ig_short_name`
- Mapování: ig_code, ig_short_name, client_code, client_name, sku, customer_name (pro párování zákazníka), requester, label_shape_code, product_format, die_cut_tool_code, assembly_code, positions_on_sheet, pieces_per_box, pieces_per_pallet, foil_type, color_coverage, ean_code, item_status, approval_status, has_print_sample

### Objednávky (`/iml/orders/import`)

- Formáty: CSV, Excel (.xlsx, .xls)
- Náhled importovaného souboru před importem
- Drag & drop mapování sloupců – přetáhněte sloupec ze zdroje na cílové pole
- Povinná pole: `order_number`, `customer_name`, `order_date`, `product_identifier` (ig_code, sku nebo client_name produktu), `quantity`
- Volitelná: `status`, `notes`, `unit_price`
- Formát: každý řádek = jedna položka objednávky; sloupce objednávky (order_number, customer, date) se opakují na každém řádku. Řádky se stejným číslem, zákazníkem a datem se sloučí do jedné objednávky.

## Oprávnění

- Modul: `iml`
- Úrovně: `read`, `write`, `admin`
- Export vyžaduje `read`
- Import a CRUD vyžaduje `write`

## API

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

## Reporty a dashboard

Na hlavní stránce IML (`/iml`):

- Počty zákazníků, produktů, objednávek
- Objednávky ke zpracování (nové + potvrzené)
- Report za 12 měsíců (počet objednávek, celková hodnota)
- Objednávky podle stavu
- Top zákazníci podle počtu objednávek
- Produkty podle stavu
- Poslední objednávky
