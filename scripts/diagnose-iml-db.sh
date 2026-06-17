#!/bin/bash
# Diagnostika IML DB na serveru – spusťte z kořene projektu po git pull
set -e
cd "$(dirname "$0")/.."

echo "=============================================="
echo "1) Git větev a poslední commit"
echo "=============================================="
git branch --show-current
git log -1 --oneline

echo ""
echo "=============================================="
echo "2) Stav Prisma migrací"
echo "=============================================="
npx prisma migrate status

echo ""
echo "=============================================="
echo "3) Prisma generate (ověření klienta)"
echo "=============================================="
npx prisma generate

echo ""
echo "=============================================="
echo "4) SQL diagnostika (vyžaduje mysql klienta)"
echo "    Pokud nemáte mysql v PATH, spusťte diagnose-iml-db.sql ručně."
echo "=============================================="
if [ -f .env ]; then
  # DATABASE_URL z .env – mysql://user:pass@host:port/db
  DB_URL=$(grep -E '^DATABASE_URL=' .env | cut -d= -f2- | tr -d '"' | tr -d "'")
  if [ -n "$DB_URL" ]; then
    # Jednoduchý parse pro mysql://user:pass@host:port/database
    echo "Spouštím SQL z scripts/diagnose-iml-db.sql ..."
    npx prisma db execute --file scripts/diagnose-iml-db.sql 2>/dev/null || {
      echo "Poznámka: prisma db execute selhalo – spusťte SQL ručně v Adminer/phpMyAdmin."
    }
  fi
else
  echo "Soubor .env nenalezen – přeskočeno."
fi

echo ""
echo "=============================================="
echo "Hotovo. Pošlete celý výstup tohoto skriptu + výsledek SQL."
echo "=============================================="
