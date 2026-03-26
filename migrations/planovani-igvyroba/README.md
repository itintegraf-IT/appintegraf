# Migrace dat z igvyroba do appintegraf

Přenos dat modulu **Plánování výroby** ze zdrojové databáze **igvyroba** (PlanovaniVyroby) do `appintegraf`.

## Příprava cílové databáze

V cílové DB musí existovat tabulky `planovani_*`. Pokud je ještě nemáte:

```bash
npm run db:planovani-upgrade
```

## Konfigurace (.env doporučeno)

V kořeni projektu v `.env`:

| Proměnná | Význam |
|----------|--------|
| `DATABASE_URL` | Cíl – aplikace APPIntegraf (`…/appintegraf`) |
| `SOURCE_DATABASE_URL` | Zdroj – databáze PlanovaniVyroby (`…/idvyroba`) |

Alternativně místo `SOURCE_DATABASE_URL` použijte `IDVYROBA_DATABASE_URL` nebo `IGVYROBA_DATABASE_URL`.

Pokud zdroj v `.env` není, použije se výchozí z `config.mjs` (localhost, databáze **`igvyroba`**).

## Spuštění

```bash
cd APPIntegraf-NEXT
npm run migrate:idvyroba
```

Stejný skript také:

```bash
npm run migrate:planovani
```

Nebo přímo:

```bash
node migrations/planovani-igvyroba/migrate.mjs
```

## Co se migruje

| Zdroj (Prisma / MySQL název tabulky) | Cíl (appintegraf) |
|--------------------------------------|-------------------|
| CodebookOption / codebookoption      | `planovani_codebook_options` |
| CompanyDay / companyday            | `planovani_company_days`     |
| Block / block                       | `planovani_blocks`           |

Skript před importem **smaže** existující řádky v těchto třech cílových tabulkách.

## Poznámka: celá databáze

Tento skript **nemigruje** celou databázi `igvyroba` do `appintegraf` – jen uvedené tabulky plánování. Pokud by obě databáze měly **identické schéma** a chtěli byste kopii celé DB, použijte nástroje serveru (např. `mysqldump` / import) – to je mimo tento projekt a riskantní, pokud se schémata liší.
