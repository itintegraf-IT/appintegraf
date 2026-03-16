# INTEGRAF – Next.js

Migrace INTEGRAF aplikace na Next.js. Fáze 0 dokončena.

## Požadavky

- Node.js 20+
- MySQL/MariaDB (AMPPS) s databází `appintegraf`

## Instalace

```bash
npm install
```

## Konfigurace

1. Zkopírujte `.env.example` do `.env`
2. Upravte `DATABASE_URL` podle vašeho prostředí (výchozí: `mysql://root:mysql@localhost:3306/appintegraf`)

## Spuštění

```bash
# Vývoj
npm run dev

# Produkce
npm run build
npm start
```

Aplikace běží na [http://localhost:3000](http://localhost:3000).

## Ověření

- **Health check:** [http://localhost:3000/api/health](http://localhost:3000/api/health) – ověří připojení k DB
- **Přihlášení:** [http://localhost:3000/login](http://localhost:3000/login) – použijte existující přihlašovací údaje z PHP aplikace

## Struktura (Fáze 0 + 1)

- `app/` – stránky
  - `(dashboard)/` – chráněné stránky s layoutem (Header, Sidebar)
  - `login/` – přihlášení
- `app/api/` – API routes (auth, health)
- `components/layout/` – Header, Sidebar
- `lib/` – db.ts, auth-utils.ts (hasModuleAccess, isAdmin)
- `auth.ts` – NextAuth konfigurace (credentials provider)
- `middleware.ts` – ochrana rout, přesměrování
- `prisma/schema.prisma` – schéma z introspected DB

## Další kroky (Fáze 2)

Migrace modulů – viz [MIGRACE_NEXTJS.md](../MIGRACE_NEXTJS.md) v kořeni projektu.
