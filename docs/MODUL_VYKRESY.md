# Modul Technické výkresy

Evidence CAD výkresů, PDF a 3D modelů (STL, 3MF, OBJ, STEP, IGES, DWG, DXF).

## Oprávnění

Modul klíč: `vykresy` (Admin → uživatelé).

| Úroveň | Možnosti |
|--------|----------|
| `read` | Seznam, detail, stažení souborů |
| `write` / `admin` | CRUD záznamů, upload/mazání souborů, správa číselníku strojů |

## Datový model

- **`vykresy`** – metadata: název, `document_kind` (`model_3d` \| `cad` \| `pdf` \| `other`), oddělení (`departments`), stroj (`vykresy_machines`), popis
- **`vykresy_machines`** – číselník strojů (název, aktivní, pořadí)
- **`file_uploads`** – přílohy (`module = vykresy`, `record_id` = id záznamu)

Soubory na disku: `public/uploads/vykresy/` (ne BLOB v DB). Limit 50 MB.

## UI

| Cesta | Popis |
|-------|--------|
| `/vykresy` | Seznam + filtry (název, typ, oddělení, stroj) |
| `/vykresy/new` | Nový záznam |
| `/vykresy/[id]` | Detail + přílohy (upload/download) |
| `/vykresy/[id]/edit` | Úprava metadat |
| `/vykresy/stroje` | Číselník strojů |

## Migrace

```bash
npm run db:vykresy-migrate
npx prisma generate
```

SQL: `prisma/migrations/20260918120000_vykresy_module/migration.sql`

## Mimo scope (v1)

- 3D náhled v prohlížeči
- Verzování souborů
- Vazba na IML / plánování XL_*
