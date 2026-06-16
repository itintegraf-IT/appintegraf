#!/usr/bin/env bash
# Vyčištění katalogu IML produktů na produkci (destruktivní operace).
#
# Vyžaduje: .env s DATABASE_URL, mysql klient, mysqldump.
#
# Použití z kořene repozitáře na serveru:
#   chmod +x scripts/wipe-iml-products.sh
#   ./scripts/wipe-iml-products.sh              # záloha + potvrzení + wipe
#   ./scripts/wipe-iml-products.sh --dry-run    # jen výpis počtů, bez mazání
#   ./scripts/wipe-iml-products.sh --skip-backup  # nouze (nedoporučeno)
#
# SQL: prisma/migrations/manual/20260616_wipe_iml_products.sql

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

SQL_FILE="prisma/migrations/manual/20260616_wipe_iml_products.sql"
DRY_RUN=0
SKIP_BACKUP=0
BACKUP_DIR="${BACKUP_DIR:-$ROOT/backups}"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run) DRY_RUN=1; shift ;;
    --skip-backup) SKIP_BACKUP=1; shift ;;
    -h|--help)
      sed -n '1,14p' "$0" | tail -n +2
      exit 0
      ;;
    *)
      echo "Neznámý argument: $1 (zkuste --help)" >&2
      exit 1
      ;;
  esac
done

if [[ ! -f .env ]]; then
  echo "CHYBA: V $ROOT chybí soubor .env (DATABASE_URL)." >&2
  exit 1
fi

if [[ ! -f "$SQL_FILE" ]]; then
  echo "CHYBA: Nenalezen $SQL_FILE" >&2
  exit 1
fi

set -a
# shellcheck disable=SC1091
. ./.env
set +a

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "CHYBA: DATABASE_URL není v .env." >&2
  exit 1
fi

if [[ "$DATABASE_URL" =~ ^mysql://([^:]+):([^@]+)@([^:/]+)(:([0-9]+))?/([^?]+) ]]; then
  DB_USER="${BASH_REMATCH[1]}"
  DB_PASS="${BASH_REMATCH[2]}"
  DB_HOST="${BASH_REMATCH[3]}"
  DB_PORT="${BASH_REMATCH[5]:-3306}"
  DB_NAME="${BASH_REMATCH[6]}"
else
  echo "CHYBA: neumím rozparsovat DATABASE_URL." >&2
  exit 1
fi

mysql_cmd() {
  mysql --default-character-set=utf8mb4 \
    -u "$DB_USER" -p"$DB_PASS" -h "$DB_HOST" -P "$DB_PORT" "$DB_NAME" "$@"
}

echo "==> Databáze: $DB_NAME @ $DB_HOST:$DB_PORT"
echo "==> Aktuální počty IML produktů a vazeb:"
mysql_cmd -e "
  SELECT 'iml_products' AS tbl, COUNT(*) AS cnt FROM iml_products
  UNION ALL SELECT 'iml_order_items', COUNT(*) FROM iml_order_items
  UNION ALL SELECT 'iml_inquiry_items', COUNT(*) FROM iml_inquiry_items
  UNION ALL SELECT 'iml_product_files', COUNT(*) FROM iml_product_files
  UNION ALL SELECT 'iml_product_colors', COUNT(*) FROM iml_product_colors;
"

if [[ "$DRY_RUN" -eq 1 ]]; then
  echo ""
  echo "Dry-run: mazání neproběhlo. Pro provedení spusťte bez --dry-run."
  exit 0
fi

if [[ "$SKIP_BACKUP" -eq 0 ]]; then
  mkdir -p "$BACKUP_DIR"
  STAMP="$(date +%Y%m%d_%H%M%S)"
  BACKUP_FILE="$BACKUP_DIR/backup_before_iml_wipe_${STAMP}.sql"
  echo "==> Záloha celé databáze do: $BACKUP_FILE"
  mysqldump --default-character-set=utf8mb4 \
    -u "$DB_USER" -p"$DB_PASS" -h "$DB_HOST" -P "$DB_PORT" \
    --single-transaction --routines --triggers \
    "$DB_NAME" > "$BACKUP_FILE"
  if [[ ! -s "$BACKUP_FILE" ]]; then
    echo "CHYBA: Záloha je prázdná, přerušuji." >&2
    exit 1
  fi
  echo "    OK ($(wc -c < "$BACKUP_FILE" | tr -d ' ') bajtů)"
else
  echo "==> VAROVÁNÍ: záloha přeskočena (--skip-backup)"
fi

echo ""
echo "!!! DESTRUKTIVNÍ OPERACE !!!"
echo "Smaže se celý katalog iml_products včetně PDF/obrázků a položek objednávek/poptávek."
echo "Zákazníci IML (iml_customers) a hlavičky objednávek zůstanou."
echo ""
read -r -p "Napište přesně ANO pro pokračování: " CONFIRM
if [[ "$CONFIRM" != "ANO" ]]; then
  echo "Zrušeno."
  exit 1
fi

echo "==> Spouštím wipe: $SQL_FILE"
mysql_cmd < "$SQL_FILE"

echo ""
echo "Hotovo. Ověřte v aplikaci: /iml/products (prázdný seznam)."
echo "Volitelně smažte prázdné objednávky – viz komentář na konci SQL souboru."
