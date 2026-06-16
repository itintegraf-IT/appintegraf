# Vyčištění katalogu IML produktů (produkce)

Destruktivní údržba: smaže **všechny produkty** a data na ně navázaná. Určeno pro reset katalogu před novým importem.

## Co se smaže

| Tabulka | Obsah |
|---------|--------|
| `iml_products` | Katalog včetně `image_data`, `pdf_data`, `custom_data` |
| `iml_product_files` | Verzovaná PDF |
| `iml_product_colors` | Pantone řádky na produktu |
| `iml_order_items` | Položky objednávek odkazující na produkt |
| `iml_inquiry_items` | Položky poptávek odkazující na produkt |

## Co zůstane

- `iml_customers`, `iml_orders`, `iml_inquiries` (hlavičky – po wipe mohou být **bez položek**)
- `iml_pantone_colors`, `iml_foils`, `materials`
- `audit_log` (záznamy o produktech zůstanou v historii)
- Ostatní moduly aplikace beze změny

## Postup na produkci (srv-igweb)

```bash
cd /var/www/appintegraf
git pull
chmod +x scripts/wipe-iml-products.sh

# 1) Kontrola počtů bez mazání
./scripts/wipe-iml-products.sh --dry-run

# 2) Záloha + wipe (vyžaduje napsat ANO)
./scripts/wipe-iml-products.sh
```

Záloha se uloží do `backups/backup_before_iml_wipe_YYYYMMDD_HHMMSS.sql`.

Ruční spuštění SQL:

```bash
mysql -u … -p appintegraf < prisma/migrations/manual/20260616_wipe_iml_products.sql
```

## Dopad na aplikaci (review FK / kódu)

Ověřeno proti `prisma/schema.prisma` a API:

| Oblast | Po wipe |
|--------|---------|
| `/iml/products` | Prázdný seznam, API vrací `products: []` |
| Dashboard `/iml` | `productsCount` = 0, ostatní statistiky z objednávek/zákazníků fungují |
| Report Pantone | Prázdný report (join přes `iml_order_items` → produkt) |
| Detail objednávky | Objednávky **bez položek** zobrazí prázdnou tabulku – data jsou konzistentní, ale k historii nic neukážou |
| Import produktů | Nový import funguje do prázdného katalogu |
| Materiály | FK z `iml_products` na `materials` je `ON DELETE SET NULL` – mazání produktů materiály neodstraní |
| `file_uploads` | Produkty nepoužívají `file_uploads` (jen zákazníci `module=iml_customers`) |

**Doporučení po wipe:** pokud nechcete „mrtvé“ objednávky/poptávky bez řádků, odkomentujte volitelný blok na konci SQL skriptu (smazání `iml_orders` / `iml_inquiries` bez položek).

## Obnova ze zálohy

```bash
pm2 stop appintegraf
mysql -u … -p appintegraf < backups/backup_before_iml_wipe_….sql
pm2 start appintegraf
```

## Soubory

- SQL: [`prisma/migrations/manual/20260616_wipe_iml_products.sql`](../prisma/migrations/manual/20260616_wipe_iml_products.sql)
- Skript: [`scripts/wipe-iml-products.sh`](../scripts/wipe-iml-products.sh)

**Poznámka:** SQL není v `prisma migrate deploy` – spouští se jen ručně.
