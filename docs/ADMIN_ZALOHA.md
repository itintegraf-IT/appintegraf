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

## Export

1. Vyberte moduly (výchozí: vše).
2. Klikněte **Stáhnout zálohu**.
3. ZIP se stáhne do prohlížeče.

## Obnova (režim „nahradit“)

Data vybraných modulů se **smažou** a nahradí obsahem zálohy.

1. Nahrajte ZIP (max. **60 MB**) nebo použijte **obnovu ze serveru** (viz níže).
2. Zkontrolujte náhled manifestu.
3. Vyberte moduly k obnově.
4. Napište potvrzení **`OBNOVIT`**.
5. Spusťte obnovu.

**Poznámky:**

- Hesla uživatelů (`password_hash`) se obnoví; **2FA TOTP** je po obnově nutné znovu nastavit.
- Obnova je destruktivní – doporučujeme nejdřív export aktuálního stavu.

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
