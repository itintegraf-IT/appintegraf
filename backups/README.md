# Backups

Adresář pro zálohy databáze pořízené před rizikovými operacemi (migrace, větší refaktor, úklid).

## Konvence pojmenování

```
pre_<popis>_<YYYY-MM-DD>[_HHMM].sql
```

Příklady:
- `pre_iml_newsec_phase1_2026-04-21.sql` – před migrací IML rozšíření, fáze 1
- `pre_iml_newsec_phase7_cleanup_2026-05-10.sql` – před úklidem legacy sloupců

## Jak vytvořit zálohu (Windows / AMPPS)

```powershell
$date = Get-Date -Format "yyyy-MM-dd_HHmm"
& "C:\Program Files\Ampps\mysql\bin\mysqldump.exe" `
  --host=localhost --port=3306 --user=root --password=mysql `
  --single-transaction --routines --triggers --events `
  --default-character-set=utf8mb4 `
  appintegraf > "backups/pre_<popis>_$date.sql"
```

## Jak obnovit zálohu

```powershell
Get-Content "backups/pre_<popis>_<date>.sql" | `
  & "C:\Program Files\Ampps\mysql\bin\mysql.exe" `
  --host=localhost --port=3306 --user=root --password=mysql appintegraf
```

## Pravidla

- Soubory `.sql` v tomto adresáři **nejsou** v gitu (`.gitignore`), obsahují citlivá data.
- Před každou IML migrací (Fáze 1, 7) pořídit zálohu – viz `docs/IML_NEWSEC_IMPLEMENTATION.md` sekce 0.3.6.
- Zálohy starší než 30 dní lze mazat po ověření stability.
- Pro produkční zálohy používejte zvláštní prefix (`prod_`) a **nikdy** je nepřenášejte na dev stroj s jiným AUTH_SECRET.
