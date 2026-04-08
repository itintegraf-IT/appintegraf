# Nasazení (produkce)

Stručný návod pro nasazení aplikace **APPIntegraf** na Linux server po odeslání změn do Gitu (`git push`).

## Automatický skript (doporučeno)

Skript před stažením obnoví `package-lock.json` z repa (aby `git pull` nepadal po předchozím `npm install` na serveru), stáhne kód z `origin/main`, ověří shodu s Gitem, nainstaluje závislosti, zkusí Prisma migrace, volitelně SQL upgrade plánování, provede build a restartuje PM2.

| | |
|---|---|
| **Soubor** | [`scripts/deploy-server.sh`](scripts/deploy-server.sh) |
| **Spuštění** | z kořene repozitáře na serveru |

```bash
cd /var/www/appintegraf
chmod +x scripts/deploy-server.sh   # jednou
./scripts/deploy-server.sh
```

Pokud Linux hlásí `bash\r: No such file or directory`, soubor má **Windows konce řádků (CRLF)**. Oprava na serveru: `sed -i 's/\r$//' scripts/deploy-server.sh` — nebo stáhněte z Gitu verzi s `.gitattributes` (`*.sh` → LF).

### Přepínače

| Přepínač | Význam |
|----------|--------|
| `--planovani-upgrade` | Spustí `npm run db:planovani-upgrade` (SQL změny modulu plánování výroby). |
| `--skip-migrate` | Přeskočí `npx prisma migrate deploy`. |
| `--skip-build` | Přeskočí `npm run build` (nouzově). |
| `--pm2-name NÁZEV` | Jiný název procesu PM2 než výchozí `appintegraf`. |

Proměnná prostředí `PM2_APP_NAME` místo `--pm2-name` také funguje.

### Co skript po `git pull` ověří

- aktuální větev je **`main`**;
- **`HEAD`** odpovídá **`origin/main`** (server má přesně commit z GitHubu);
- **čistý working tree** (žádné neuložené změny v sledovaných souborech).

Při nesouladu skript skončí chybou a build ani restart se nespustí.

### Požadavky na serveru

- soubor **`.env`** v kořeni projektu (`DATABASE_URL`, `AUTH_SECRET`, `AUTH_URL`, …);
- **Node.js** v rozsahu z `package.json` (`engines`);
- **PM2** s aplikací (např. `ecosystem.config.js`, výchozí název `appintegraf`);
- oprávnění ke **`git pull`** v adresáři projektu.

### Prisma migrace

`npx prisma migrate deploy` může skončit chybou (např. **P3005**), pokud v repu nejsou migrace ve `prisma/migrations`, ale databáze už tabulky obsahuje — u tohoto projektu to může být očekávané. Skript v takovém případě vypíše upozornění a **pokračuje**. Schéma pro modul plánování se někdy doplňuje skriptem `db:planovani-upgrade`.

### Ruční postup (bez skriptu)

1. `git pull origin main` (případně `git restore package-lock.json`, pokud Git hlásí lokální změny).
2. `npm install --legacy-peer-deps`
3. `npx prisma generate` (běží i v `postinstall`)
4. volitelně `npx prisma migrate deploy`
5. při potřebě SQL pro plánování: `npm run db:planovani-upgrade`
6. `npm run build`
7. `pm2 restart appintegraf` (nebo váš název procesu)

### Ruční SQL (moduly mimo Prisma migrate)

Po změnách v `schema.prisma` mohou v `prisma/migrations/*.sql` ležet skripty, které je potřeba na produkci spustit ručně (např. modul smluv, osobní údaje u kontaktů). Bez toho může aplikace při dotazu na chybějící sloupce/tabulky spadnout (Next.js „Application error“).

| Soubor | Účel |
|--------|------|
| [`prisma/migrations/20260327_add_contracts_module.sql`](prisma/migrations/20260327_add_contracts_module.sql) | Tabulky evidence smluv |
| [`prisma/migrations/20260327_file_uploads_record_id.sql`](prisma/migrations/20260327_file_uploads_record_id.sql) | `file_uploads.record_id` |
| [`prisma/migrations/20260328_users_personal_contact.sql`](prisma/migrations/20260328_users_personal_contact.sql) | Sloupce `users.personal_phone`, `users.personal_email` (kontakty) |
| [`prisma/migrations/20260408_add_ukoly_module.sql`](prisma/migrations/20260408_add_ukoly_module.sql) | Tabulky modulu Úkoly (`ukoly`, `ukoly_departments`) |

```bash
mysql -u root -p appintegraf < prisma/migrations/20260328_users_personal_contact.sql
```

## Přenos dat plánování (vývoj → produkce)

Skript **nenahrazuje** kopírování dat v MySQL. Mezi prostředími se tabulky `planovani_*` přenášejí např. přes **`mysqldump`** / import SQL. U dumpu z MySQL 8 na MariaDB může být potřeba nahradit kolaci `utf8mb4_0900_ai_ci` za např. `utf8mb4_unicode_ci` před importem.

## Konfigurace PM2

Viz [`ecosystem.config.js`](ecosystem.config.js) — upravte `cwd`, proměnné prostředí a port podle serveru. Citlivé údaje držte v **`.env`** na serveru, ne v repozitáři.

## Související soubory

- [`scripts/deploy-server.sh`](scripts/deploy-server.sh) — nasazovací skript  
- [`scripts/run-planovani-db-upgrade.mjs`](scripts/run-planovani-db-upgrade.mjs) — SQL upgrade plánování  
- [`migrations/planovani-igvyroba/README.md`](migrations/planovani-igvyroba/README.md) — migrace dat z databáze PlanovaniVyroby (`migrate:idvyroba`)  
- [`.env.example`](.env.example) — šablona proměnných prostředí  
