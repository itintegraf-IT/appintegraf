# Migrace dat z igvyroba do appintegraf

Přenos dat modulu Plánování výroby z původní databáze igvyroba (PlanovaniVyroby) do appintegraf.

## Použití

1. **Upravte konfiguraci** v souboru `config.mjs` (host, user, password, database).

2. **Spusťte migraci** z adresáře `appintegraf-next`:
   ```bash
   cd appintegraf-next
   npm run migrate:planovani
   ```

   Nebo přímo:
   ```bash
   node migrations/planovani-igvyroba/migrate.mjs
   ```

## Co se migruje

| Zdroj (igvyroba) | Cíl (appintegraf) |
|------------------|-------------------|
| CodebookOption   | planovani_codebook_options |
| CompanyDay       | planovani_company_days     |
| Block            | planovani_blocks            |

## Poznámka

Skript před importem **smaže** existující data v cílových tabulkách.
