# Modul Technologie – rozkresy tiskových archů

Evidence rozkresů pro tiskové archy (PDF, automatický JPEG náhled z 1. stránky).

## Oprávnění

Modul klíč: `technologie` (Admin → uživatelé).

| Úroveň | Možnosti |
|--------|----------|
| `read` | Seznam, detail, stažení PDF, náhled PDF a miniatury |
| `write` / `admin` | CRUD rozkresů, upload/mazání PDF, správa typů archů; společný číselník strojů |

## Datový model

- **`technologie`** – kód (unikátní), název, typ archu, formát, velikost archu, tiskový stroj, poznámka, `preview_updated_at`
- **`technologie_sheet_types`** – číselník typů archu (volný list, V1, …) – jen Technologie
- **`technologie_sheet_sizes`** – číselník velikostí archu (1020x720, 1000x700, …) – jen Technologie
- **`shared_machines`** – **společný** číselník strojů s modulem Výkresy (`machine_group`: `press` \| `postpress`)
- **`file_uploads`** – `module = technologie`, `document_type`: `pdf` \| `thumbnail`

Soubory: `public/uploads/technologie/`. Limit PDF 50 MB.

## UI

| Cesta | Popis |
|-------|--------|
| `/technologie` | Seznam + filtry |
| `/technologie/new` | Nový rozkres |
| `/technologie/[id]` | Detail + upload PDF |
| `/technologie/[id]/edit` | Úprava metadat |
| `/technologie/ciselniky` | Typy archů, velikosti archů + odkaz na společné stroje |
| `/stroje` | Společný číselník strojů (Press / Postpress) |

Náhled v seznamu: `GET /api/technologie/[id]/preview` (JPEG). PDF inline: `GET /api/technologie/[id]/files/[fileId]?inline=1`.

Stroje API: `GET/POST /api/shared-machines` (alias `/api/technologie/print-machines`).

## Migrace

```bash
npm run db:technologie-migrate
npm run db:shared-machines-migrate
npm run db:technologie-sheet-sizes-migrate
npx prisma generate
```

SQL: `prisma/migrations/20261009120000_technologie_module/migration.sql`  
Skript přesunu starých `vykresy_machines` / `technologie_print_machines`: `npm run db:shared-machines-migrate`

## Mimo scope

- Sjednocení s Plánováním (`XL_105` / `XL_106` jako enum)
- Ruční upload náhledu
- Vazba na zakázku / IML produkt
