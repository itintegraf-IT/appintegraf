#!/usr/bin/env bash
# Nasazení na produkční Linux server (po git push).
# Spouštějte z kořene repozitáře na serveru, např.:
#   chmod +x scripts/deploy-server.sh
#   ./scripts/deploy-server.sh
#
# Vyžaduje: .env s DATABASE_URL, Node 20.x, PM2, oprávnění k git pull.
#
# Po stažení kódu ověří: větev main, HEAD == origin/main, čistý working tree.
#
# Přepínače:
#   --planovani-upgrade   spustí npm run db:planovani-upgrade (SQL změny plánování)
#   --skip-migrate        přeskočí npx prisma migrate deploy
#   --skip-build          přeskočí npm run build (jen pro nouzi)
#   --pm2-name JMÉNO       výchozí: appintegraf (nebo env PM2_APP_NAME)

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

PM2_NAME="${PM2_APP_NAME:-appintegraf}"
SKIP_MIGRATE=0
SKIP_BUILD=0
DO_PLANOVANI=0

usage() {
  sed -n '1,25p' "$0" | tail -n +2
  exit 0
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --planovani-upgrade) DO_PLANOVANI=1; shift ;;
    --skip-migrate) SKIP_MIGRATE=1; shift ;;
    --skip-build) SKIP_BUILD=1; shift ;;
    --pm2-name)
      PM2_NAME="${2:?}"
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

echo "==> Git: package-lock.json – zahodit lokální změny (po npm install na serveru často přepsán)"
git restore package-lock.json 2>/dev/null || true

echo "==> Git: fetch + pull (jen fast-forward)"
git fetch origin main
git pull --ff-only origin main

echo "==> Git: ověření (musí odpovídat origin/main, žádné lokální změny)"
branch="$(git rev-parse --abbrev-ref HEAD)"
if [[ "$branch" != "main" ]]; then
  echo "CHYBA: očekávána větev main, aktuální: $branch" >&2
  exit 1
fi

head_sha="$(git rev-parse HEAD)"
origin_sha="$(git rev-parse origin/main)"
if [[ "$head_sha" != "$origin_sha" ]]; then
  echo "CHYBA: HEAD se neshoduje s origin/main." >&2
  echo "  HEAD:         $head_sha" >&2
  echo "  origin/main:  $origin_sha" >&2
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
