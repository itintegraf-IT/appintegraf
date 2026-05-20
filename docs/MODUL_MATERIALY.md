# Modul Katalog materiálů – dokumentace

Centrální evidence materiálů (papír, fólie, barvy, laky) včetně bezpečnostních listů (SDS), technických listů (TDS) a certifikátů. Modul je propojen s IML – produkty mohou vybírat materiály z katalogu.

---

## Přehled

| Položka | Hodnota |
|---------|---------|
| **Modul** | `materialy` |
| **Cesta** | `/materialy` |
| **Oprávnění zápisu** | `materialy: write` |
| **Oprávnění čtení** | `materialy: read` nebo `iml: read` (pro výběr materiálů v IML) |
| **Přílohy** | `file_uploads` s `module = 'materialy'`, soubory v `public/uploads/materialy/` |

---

## Stránky

| Funkce | Cesta | Popis |
|--------|-------|-------|
| Přehled kategorií | `/materialy` | Dlaždice Papír, Fólie, Barvy, Laky + globální vyhledávání |
| Seznam v kategorii | `/materialy/papir`, `/foilie`, `/barvy`, `/laky` | Filtr podkategorií, tabulka materiálů |
| Detail | `/materialy/[id]` | Údaje materiálu, přílohy, platnost certifikátu |
| Nový / úprava | `/materialy/add`, `/materialy/[id]/edit` | Formulář (vyžaduje write) |

---

## Kategorie

| Kód | Název | Slug |
|-----|-------|------|
| `PAPER` | Papír | `papir` |
| `FOIL` | Fólie | `foilie` |
| `COLOR` | Barvy | `barvy` |
| `LACQUER` | Laky | `laky` |

Podkategorie se spravují v rámci kategorie (API `subcategories`).

---

## Typy dokumentů (přílohy)

| Typ | Popis |
|-----|-------|
| `SDS` | Bezpečnostní list |
| `TDS` | Technický list |
| `CERTIFICATE` | Certifikát |
| `OTHER` | Jiný dokument |

Povolené formáty: PDF, obrázky (JPEG, PNG, WebP, GIF), Word, Excel (max 20 MB).

---

## Databázové tabulky

- `material_categories` – číselník kategorií
- `material_subcategories` – podkategorie
- `materials` – hlavní evidence (název, kód, výrobce, dodavatel, platnost certifikátu `certificate_valid_until`, CMYK u barev, …)
- `file_uploads` – metadata příloh (`record_id` = `materials.id`)

---

## API (přehled)

| Metoda | Endpoint | Popis |
|--------|----------|-------|
| GET | `/api/materialy` | Seznam (`category`, `subcategoryId`, `q`, `active`) |
| POST | `/api/materialy` | Nový materiál |
| GET/PUT/DELETE | `/api/materialy/[id]` | Detail, úprava, soft delete / permanent |
| GET/POST | `/api/materialy/[id]/files` | Přílohy |
| GET | `/api/materialy/options` | Možnosti pro selecty (IML) |
| CRUD | `/api/materialy/subcategories` | Podkategorie |

---

## Vazba na IML

Na produktu (`iml_products`) lze vybrat materiály z katalogu:

- `foil_material_id`, `color_material_id`, `paper_material_id`, `lacquer_material_id`
- Pantone barvy produktu odkazují na `iml_pantone_colors` (kompatibilita s katalogem barev)

Uživatel s přístupem pouze k IML (`iml: read`) může katalog **číst**, ale nemusí mít `materialy: write`.

---

## Nasazení

Na produkci spusťte SQL migraci (jednou):

- [`prisma/migrations/20260520_materialy_module.sql`](../prisma/migrations/20260520_materialy_module.sql)
- případně související Prisma migrace v `prisma/migrations/20260518100000_materialy_module/`

---

## Související dokumentace

- [MODUL_IML.md](./MODUL_IML.md) – produkty a objednávky IML
- [IML_NEWSEC_IMPLEMENTATION.md](./IML_NEWSEC_IMPLEMENTATION.md) – implementační plán rozšíření IML
