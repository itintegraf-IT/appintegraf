#!/usr/bin/env bash
# Nasazení na produkční Linux server (po git push).
# Spouštějte z kořene repozitáře na serveru, např.:
#   chmod +x scripts/deploy-server.sh
#   ./scripts/deploy-server.sh
#
# Vyžaduje: .env s DATABASE_URL, Node 20.x, PM2, oprávnění k git pull.
#
# Po stažení kódu ověří: větev odpovídá originu, čistý working tree.
#
# Přepínače:
#   --branch VĚTEV        výchozí: main (na test serveru: test)
#   --planovani-upgrade   spustí npm run db:planovani-upgrade (SQL změny plánování)
#   --apply-sql SOUBOR    spustí konkrétní SQL soubor z prisma/migrations/ přes mysql klienta
#                         (lze uvést víckrát). Vyžaduje .env s DATABASE_URL.
#                         Příklad: --apply-sql 20260420_auth_tokens.sql
#   --skip-migrate        přeskočí npx prisma migrate deploy
#   --skip-build          přeskočí npm run build (jen pro nouzi)
#   --pm2-name JMÉNO       výchozí: appintegraf (nebo env PM2_APP_NAME)

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

DEPLOY_BRANCH="${DEPLOY_BRANCH:-main}"
PM2_NAME="${PM2_APP_NAME:-appintegraf}"
SKIP_MIGRATE=0
SKIP_BUILD=0
DO_PLANOVANI=0
SQL_FILES=()

usage() {
  sed -n '1,28p' "$0" | tail -n +2
  exit 0
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --planovani-upgrade) DO_PLANOVANI=1; shift ;;
    --apply-sql)
      SQL_FILES+=("${2:?chybí cesta k SQL souboru}")
      shift 2
      ;;
    --skip-migrate) SKIP_MIGRATE=1; shift ;;
    --skip-build) SKIP_BUILD=1; shift ;;
    --pm2-name)
      PM2_NAME="${2:?}"
      shift 2
      ;;
    --branch)
      DEPLOY_BRANCH="${2:?}"
      shift 2
      ;;
    -h|--help) usage ;;
    *)
      echo "Neznámý argument: $1 (zkuste --help)" >&2
      exit 1
      ;;
  esac
done

if [[ ! -f .env ]]; then
  echo "CHYBA: V $ROOT chybí soubor .env (potřeba DATABASE_URL, AUTH_*, …)." >&2
  exit 1
fi

echo "==> Nasazení: větev=$DEPLOY_BRANCH | PM2 proces=$PM2_NAME | adresář=$ROOT"

echo "==> Git: package-lock.json – zahodit lokální změny (po npm install na serveru často přepsán)"
git restore package-lock.json 2>/dev/null || true

echo "==> Git: fetch + pull (jen fast-forward, větev: $DEPLOY_BRANCH)"
git fetch origin "$DEPLOY_BRANCH"
git checkout "$DEPLOY_BRANCH"
git pull --ff-only "origin/$DEPLOY_BRANCH"

echo "==> Git: ověření (musí odpovídat origin/$DEPLOY_BRANCH, žádné lokální změny)"
branch="$(git rev-parse --abbrev-ref HEAD)"
if [[ "$branch" != "$DEPLOY_BRANCH" ]]; then
  echo "CHYBA: očekávána větev $DEPLOY_BRANCH, aktuální: $branch" >&2
  exit 1
fi

head_sha="$(git rev-parse HEAD)"
origin_sha="$(git rev-parse "origin/$DEPLOY_BRANCH")"
if [[ "$head_sha" != "$origin_sha" ]]; then
  echo "CHYBA: HEAD se neshoduje s origin/$DEPLOY_BRANCH." >&2
  echo "  HEAD:                $head_sha" >&2
  echo "  origin/$DEPLOY_BRANCH: $origin_sha" >&2
  exit 1
fi

if [[ -n "$(git status --porcelain)" ]]; then
  echo "CHYBA: pracovní kopie není čistá (soubory mimo Git):" >&2
  git status --short
  exit 1
fi

echo "    OK: $(git log -1 --oneline)"

echo "==> npm install (--legacy-peer-deps)"
npm install --legacy-peer-deps

if [[ "$SKIP_MIGRATE" -eq 0 ]]; then
  echo "==> Prisma: migrate deploy"
  set +e
  npx prisma migrate deploy
  migrate_exit=$?
  set -e
  if [[ "$migrate_exit" -ne 0 ]]; then
    echo ""
    echo "Upozornění: migrate deploy skončil s kódem $migrate_exit."
    echo "  Často OK, pokud v repu nejsou žádné migrace v prisma/migrations (P3005)"
    echo "  nebo pokud schéma spravujete jinak. Pokračuji v nasazení."
    echo ""
  fi
fi

if [[ "$DO_PLANOVANI" -eq 1 ]]; then
  echo "==> SQL upgrade plánování (db:planovani-upgrade)"
  npm run db:planovani-upgrade
fi

if [[ "${#SQL_FILES[@]}" -gt 0 ]]; then
  echo "==> SQL migrace (--apply-sql)"
  if [[ -z "${DATABASE_URL:-}" ]]; then
    # Načti z .env, pokud není v prostředí
    set -a; . ./.env; set +a
  fi
  if [[ -z "${DATABASE_URL:-}" ]]; then
    echo "CHYBA: DATABASE_URL není k dispozici (ani v .env)." >&2
    exit 1
  fi

  # Rozparsuj DATABASE_URL ve tvaru mysql://user:pass@host:port/dbname
  # (bash regex; hesla s URL-encoded znaky prosím dekódovat ručně v .env, kdyby bylo potřeba)
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

  for f in "${SQL_FILES[@]}"; do
    # Přijmi buď plnou cestu, nebo jen jméno souboru uvnitř prisma/migrations/
    if [[ -f "$f" ]]; then
      sql_path="$f"
    elif [[ -f "prisma/migrations/$f" ]]; then
      sql_path="prisma/migrations/$f"
    else
      echo "CHYBA: SQL soubor nenalezen: $f (ani v prisma/migrations/)" >&2
      exit 1
    fi
    echo "  -> aplikuji: $sql_path"
    mysql --default-character-set=utf8mb4 \
      -u "$DB_USER" -p"$DB_PASS" -h "$DB_HOST" -P "$DB_PORT" "$DB_NAME" \
      < "$sql_path"
  done
fi

if [[ "$SKIP_BUILD" -eq 0 ]]; then
  echo "==> Next.js: build"
  npm run build
else
  echo "==> Next.js: build přeskočen (--skip-build)"
fi

echo "==> PM2: restart $PM2_NAME"
pm2 restart "$PM2_NAME"

echo ""
echo "Nasazení dokončeno."
