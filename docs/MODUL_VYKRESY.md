# Modul Technické výkresy

Evidence CAD výkresů, PDF, obrázků a 3D modelů (STL, 3MF, OBJ, STEP, IGES, DWG, DXF, JPG/PNG…).

## Oprávnění

Modul klíč: `vykresy` (Admin → uživatelé).

| Úroveň | Možnosti |
|--------|----------|
| `read` | Seznam, detail, stažení, náhled PDF/obrázků |
| `write` / `admin` | CRUD záznamů, upload/mazání souborů, správa společného číselníku strojů |

## Datový model

- **`vykresy`** – metadata: název, `document_kind` (`model_3d` \| `cad` \| `pdf` \| `image` \| `other`), oddělení (`departments`), stroj (`shared_machines`), popis
- **`shared_machines`** – společný číselník strojů s modulem Technologie (`machine_group`: `press` \| `postpress`)
- **`file_uploads`** – přílohy (`module = vykresy`, `record_id` = id záznamu)

Soubory na disku: `public/uploads/vykresy/` (ne BLOB v DB). Limit 50 MB.

## UI

| Cesta | Popis |
|-------|--------|
| `/vykresy` | Seznam + filtry (název, typ, oddělení, stroj) |
| `/vykresy/new` | Nový záznam |
| `/vykresy/[id]` | Detail + přílohy (upload/download/náhled) |
| `/vykresy/[id]/edit` | Úprava metadat |
| `/stroje` | Společný číselník strojů (Press / Postpress); `/vykresy/stroje` přesměruje sem |

### Náhled souborů

V detailu: mřížka miniatur obrázků; klepnutím nebo **Náhled** se otevře modal:

| Formát | Náhled |
|--------|--------|
| PDF | iframe |
| JPG, JPEG, PNG, WebP, GIF | obrázek + zoom (+/− / Ctrl+kolečko) |
| TIFF | upload ano, náhled v prohlížeči obvykle ne |
| 3MF, STL, STEP, DWG… | bez náhledu – stažení |

API: `GET /api/vykresy/[id]/files/[fileId]?inline=1` (`Content-Disposition: inline`).

## Migrace

```bash
npm run db:vykresy-migrate
npm run db:shared-machines-migrate
npx prisma generate
```

SQL: `prisma/migrations/20260918120000_vykresy_module/migration.sql`  
Po přechodu na společný číselník: `npm run db:shared-machines-migrate`

## Mimo scope

- Interaktivní 3D náhled (three.js)
- Serverová konverze TIFF→JPEG
- Verzování souborů
- Vazba na IML / plánování XL_*
