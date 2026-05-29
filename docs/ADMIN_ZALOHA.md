# Záloha a obnova dat (administrátor)

Globální administrátor může v aplikaci exportovat a obnovovat data vybraných modulů včetně souborů na disku a IML PDF/obrázků uložených v databázi.

**Cesta v aplikaci:** Administrace → Záloha a obnova (`/admin/backup`)

## Co záloha obsahuje

ZIP archiv (`.integraf-backup.zip`):

| Část | Obsah |
|------|--------|
| `manifest.json` | Verze formátu, datum, moduly, počty řádků |
| `data/*.json` | Řádky tabulek databáze |
| `files/` | Kopie `public/uploads/…` (smlouvy, materiály, úkoly, kiosk, personalistika) |
| `blobs/iml/` | PDF a obrázky produktů IML z databáze |

## Moduly

Lze vybrat libovolnou kombinaci: Systém, Kontakty, Majetek, Kalendář, Úkoly, Personalistika, Smlouvy, Plánování, Výroba, IML, Materiály, Kiosk, IT školení, Audit log.

- **Systém** – uživatelé, role, oddělení, nastavení, typy smluv (bez session tokenů a TOTP záložních kódů).
- **Výroba** – pouze databáze; generované CSV/TXT na síťové cestě `VYROBA_OUTPUT_PATH` se nezálohují.
- Při obnově modulů závislých na uživatelích (např. Smlouvy) obvykle zaškrtněte také **Systém**.
- Pokud v obnově **není** modul Systém, aplikace **nepřepisuje ani nemaže** tabulky s účty a globálním nastavením (`users`, `roles`, `user_roles`, oddělení, `system_settings` atd.) — ochrana proti omylu a částečné obnově.

## Export

1. Vyberte moduly (výchozí: vše).
2. Klikněte **Stáhnout zálohu**.
3. ZIP se stáhne do prohlížeče (během exportu a stahování se zobrazí průběh v modálním okně, včetně přibližného objemu stažených dat).

## Obnova (režim „nahradit“)

Data vybraných modulů se **smažou** a nahradí obsahem zálohy.

1. Nahrajte ZIP (max. **60 MB**) nebo použijte **obnovu ze serveru** (viz níže).
2. Zkontrolujte náhled manifestu. Po načtení manifestu se **výběr modulů v rozhraní přizpůsobí** modulům uvedeným v záloze (`manifest.json`), aby nezůstalo omylem zaškrtnuté „vše“ při částečné záloze.
3. Případně moduly upravte — obnovit lze jen moduly, které **jsou v této záloze**. Server obnovu **odmítne**, pokud byste měli zaškrtnutý modul, který v archivu není (ochrana před smazáním tabulek bez dat v ZIP).
4. Napište potvrzení **`OBNOVIT`**.
5. Spusťte obnovu (zobrazí se modální okno s uplynulým časem; server mezitím maže data, importuje tabulky a obnovuje soubory z archivu).

### Částečná záloha a manifest

- Soubor `manifest.json` v ZIP uvádí, **které moduly** export skutečně obsahuje, a odpovídající `data/*.json`.
- **Částečná záloha** (např. jen Katalog materiálů) neobsahuje tabulky ostatních modulů. Obnova nesmí nejdřív smazat tyto tabulky a pak nenahrát žádná data — proto server vyžaduje soulad výběru s manifestem.
- Při obnově z **plné** zálohy (manifest obsahuje více modulů) můžete obnovit jen **vybranou podmnožinu** — smaží se a nahradí jen zaškrtnuté moduly. Moduly, které v manifestu nejsou, nelze zaškrtnout bez chyby ze serveru (viz výše).

### IML `iml_product_files` a PDF

Pokud v JSON záloze chybí binární PDF (`pdf_data` je null), obnova se pokusí načíst soubor z cesty `blobs/iml/product-files/{product_id}/{id}.pdf` v archivu. Když ani ten chybí, uloží se prázdný soubor (řádek zůstane, PDF doplníte ručně znovu nahráním).

**Poznámky:**

- Hesla uživatelů (`password_hash`) se obnoví; **2FA TOTP** je po obnově nutné znovu nastavit.
- Obnova je destruktivní – doporučujeme nejdřív export aktuálního stavu.

### Zamčený localhost (nelze se přihlásit)

Časté příčiny: v databázi zůstalo `totp_enrollment_required = 1` bez dokončeného TOTP, nebo je poškozený hash hesla. Pro **vývojové prostředí** můžete nouzově vytvořit nebo resetovat účet administrátora (jméno + heslo, bez 2FA):

1. V kořeni projektu mějte platný `DATABASE_URL` v `.env`.
2. V PowerShellu (příklad hesla splňuje pravidla min. 8 znaků, písmeno + číslice):

```powershell
$env:ADMIN_BOOTSTRAP_PASSWORD="VaseHeslo1"
npm run db:ensure-admin
```

Volitelně: `ADMIN_BOOTSTRAP_USERNAME` (výchozí `admin`), `ADMIN_BOOTSTRAP_EMAIL` (výchozí `admin-bootstrap@local.invalid`).

### Velké zálohy (> 60 MB)

1. Zkopírujte ZIP do složky na serveru (`BACKUP_DIR`, výchozí `./backups`).
2. V UI zvolte soubor v sekci **Obnova ze serveru**.

## Proměnné prostředí

```env
BACKUP_DIR=./backups
BACKUP_RESTORE_ENABLED=true
```

- `BACKUP_RESTORE_ENABLED=false` zakáže obnovu (export zůstává).
- Složka `backups` je v `.gitignore`.

## Disaster recovery mimo aplikaci

Pro úplnou obnovu serveru včetně schématu databáze použijte navíc pravidelný **`mysqldump`** (mimo tuto funkci). Aplikační záloha je určena pro přesun/obnovu dat mezi instancemi APPIntegraf a selektivní moduly.
