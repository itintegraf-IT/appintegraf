# INTEGRAF – Next.js

Migrace INTEGRAF aplikace z PHP na Next.js. Modulární intranetová aplikace pro správu zaměstnanců, oddělení, vybavení, kalendáře, školení a plánování výroby.

## Požadavky

- Node.js 20+
- MySQL/MariaDB (AMPPS) s databází `appintegraf`

## Instalace

```bash
npm install
```

## Konfigurace

1. Zkopírujte `.env.example` do `.env`
2. Upravte proměnné podle vašeho prostředí:
   - `DATABASE_URL` – připojení k databázi (výchozí: `mysql://root:mysql@localhost:3306/appintegraf`)
   - `AUTH_SECRET` – pro NextAuth (produkce; vygenerujte např. `openssl rand -base64 32`)

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

## Moduly

| Modul | Cesta | Popis |
|-------|-------|-------|
| Dashboard | `/` | Přehled, statistiky, notifikace, události ke schválení |
| Kontakty | `/contacts` | Evidence osob, oddělení, import, export |
| Majetek | `/equipment` | Evidence vybavení, kategorie, přiřazení |
| Kalendář | `/calendar` | Události, týdenní/měsíční zobrazení, schvalování, export .ics |
| Telefonní seznam | `/phone-list` | Seznam zaměstnanců (přihlášení) |
| Veřejný telefonní seznam | `/public/phone-list` | Bez přihlášení |
| Požadavek na techniku | `/public/equipment-request` | Veřejný formulář |
| Kiosk | `/kiosk` | Prezentace pro monitory |
| Školení | `/training` | Testy, materiály, otázky |
| Plánování | `/planovani` | Plánování výroby (bloky, codebook, dny firmy) |
| IML | `/iml` | Zákazníci, produkty, objednávky – export/import CSV/Excel |
| Admin | `/admin/*` | Uživatelé, oddělení, role, reporty |

## Struktura projektu

```
app/
├── (dashboard)/          # Chráněné stránky s layoutem (Header, Sidebar)
│   ├── page.tsx          # Dashboard
│   ├── contacts/         # Kontakty
│   ├── equipment/        # Majetek
│   ├── calendar/         # Kalendář
│   ├── phone-list/       # Telefonní seznam
│   ├── kiosk/            # Kiosk
│   ├── training/         # Školení
│   ├── planovani/        # Plánování výroby
│   ├── iml/              # IML – zákazníci, produkty, objednávky
│   ├── admin/            # Administrace
│   └── layout.tsx        # Ochrana rout – přesměrování nepřihlášených na /login
├── login/                # Přihlášení
├── public/               # Veřejné stránky (bez přihlášení)
└── api/                  # API routes (auth, health, calendar, …)
components/               # React komponenty (layout, UI)
lib/                      # db.ts, auth-utils.ts (hasModuleAccess, isAdmin, getLayoutAccess)
auth.ts                   # NextAuth (credentials provider, bcrypt)
prisma/schema.prisma      # Databázové schéma (introspected)
docs/                     # Dokumentace modulů
```

## Dokumentace

- **[Přehled dokumentace](docs/README.md)** – index všech dokumentů
- **[Modul Kalendář](docs/MODUL_KALENDAR.md)** – týdenní/měsíční zobrazení, CRUD událostí, schvalování, export .ics
- **[Kalendář – dvoufázové schvalování](docs/KALENDAR_SCHVALOVANI_FAZE2.md)** – specifikace schvalování zástup → vedoucí
- **[Modul IML](docs/MODUL_IML.md)** – zákazníci, produkty, objednávky, export/import
- **[Migrace plánování](migrations/planovani-igvyroba/README.md)** – migrace dat z igvyroba
- **[Plán migrace](MIGRACE_NEXTJS.md)** – fáze migrace z PHP na Next.js

## Skripty

| Příkaz | Popis |
|--------|-------|
| `npm run dev` | Vývojový server |
| `npm run build` | Produkční build |
| `npm start` | Produkční spuštění |
| `npm run lint` | ESLint |
| `npm run migrate:planovani` | Migrace dat z igvyroba do appintegraf |

## Technologie

- **Next.js 16** (App Router), **React 19**
- **Prisma 7** + MariaDB adapter
- **NextAuth 5** (credentials, bcrypt, JWT)
- **Tailwind CSS 4**, **Radix UI**, **date-fns**, **lucide-react**
