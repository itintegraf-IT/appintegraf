#!/usr/bin/env bash
# Jednorázový produkční release po merge test -> main (tag v2026.05.29).
# Spouštět na serveru z kořene repa: chmod +x scripts/release-prod-20260529.sh && ./scripts/release-prod-20260529.sh
#
# Před spuštěním: ověřte .env (DATABASE_URL, AUTH_SECRET, AUTH_URL=https://appintegraf.integraf.cz)

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if [[ ! -f .env ]]; then
  echo "CHYBA: chybí .env v $ROOT" >&2
  exit 1
fi

set -a
# shellcheck disable=SC1091
source .env
set +a

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "CHYBA: DATABASE_URL není v .env" >&2
  exit 1
fi

if [[ -z "${AUTH_SECRET:-}" ]]; then
  echo "CHYBA: AUTH_SECRET není v .env (povinné pro produkci)" >&2
  exit 1
fi

if [[ -z "${AUTH_URL:-}" ]]; then
  echo "VAROVÁNÍ: AUTH_URL není nastaveno – doporučeno https://appintegraf.integraf.cz" >&2
fi

if [[ "$DATABASE_URL" =~ ^mysql://([^:]+):([^@]+)@([^:/]+)(:([0-9]+))?/([^?]+) ]]; then
  DB_USER="${BASH_REMATCH[1]}"
  DB_PASS="${BASH_REMATCH[2]}"
  DB_HOST="${BASH_REMATCH[3]}"
  DB_PORT="${BASH_REMATCH[5]:-3306}"
  DB_NAME="${BASH_REMATCH[6]}"
else
  echo "CHYBA: neumím rozparsovat DATABASE_URL" >&2
  exit 1
fi

STAMP="$(date +%Y%m%d_%H%M%S)"
BACKUP_DIR="${ROOT}/backups"
mkdir -p "$BACKUP_DIR"
DUMP="${BACKUP_DIR}/pre_release_${STAMP}.sql"

echo "==> Záloha DB ${DB_NAME} -> ${DUMP}"
mysqldump -u "$DB_USER" -p"$DB_PASS" -h "$DB_HOST" -P "$DB_PORT" \
  --single-transaction --routines --triggers --hex-blob "$DB_NAME" > "$DUMP"
echo "    OK: $(wc -c < "$DUMP") bajtů"

echo "==> Git pull main + deploy (build, migrate deploy, PM2)"
./scripts/deploy-server.sh \
  --apply-sql 20260422074554_iml_newsec_phase1/migration.sql \
  --apply-sql 20260511120000_iml_orders_expected_ship_date/migration.sql \
  --apply-sql 20260518100000_materialy_module/migration.sql \
  --apply-sql 20260518120000_materials_certificate_valid_until.sql \
  --apply-sql 20260518140000_materials_iml_foil_color_fields/migration.sql \
  --apply-sql 20260519120000_iml_customers_units_contacts/migration.sql \
  --apply-sql 20260519130000_material_categories_slug/migration.sql \
  --apply-sql 20260520_materialy_module.sql \
  --apply-sql 20260520140000_materials_issued_at/migration.sql

echo "==> Volitelné jednorázové skripty (idempotentní / přeskočí se při chybě)"
set +e
npm run migrate:totp-2fa 2>/dev/null || true
node scripts/iml-newsec-phase1-migrate.mjs 2>/dev/null || true
node scripts/ensure-materials-columns.mjs 2>/dev/null || true
set -e

echo ""
echo "Release dokončen. Smoke test:"
echo "  curl -sS https://appintegraf.integraf.cz/api/health"
echo "  (přihlášení, kalendář, IML, /materialy, /admin/backup – export)"
