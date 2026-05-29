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
| Majetek | `/equipment` | Evidence vybavení, požadavky na techniku, přiřazení |
| Kalendář | `/calendar` | Události, schvalování, soukromé události, export .ics |
| Úkoly | `/ukoly` | Zadávání úkolů, archiv, statistiky |
| Personalistika | `/personalistika` | Uchazeči, pozice, brigádníci |
| Evidence smluv | `/contracts` | Smlouvy, workflow, přílohy, upozornění na platnost |
| Plánování | `/planovani` | Plánování výroby |
| Výroba | `/vyroba` | Výrobní zakázky IG52, protokoly |
| IML | `/iml` | Zákazníci, produkty, poptávky, objednávky, reporty |
| Katalog materiálů | `/materialy` | SDS/TDS/certifikáty, papír, fólie, barvy, laky |
| Kiosk | `/kiosk` | Prezentace pro monitory |
| Telefonní seznam | `/phone-list` | Seznam zaměstnanců (přihlášení) |
| Veřejný telefonní seznam | `/public/phone-list` | Bez přihlášení |
| Požadavek na techniku | `/public/equipment-request` | Veřejný formulář |
| Školení | `/training` | Testy, materiály, otázky |
| Admin | `/admin/*` | Uživatelé, role, 2FA, sdílené e-maily, reporty |
| Nápověda | `/help/{slug}` | Dokumentace modulů z `docs/` |

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
│   ├── ukoly/            # Úkoly
│   ├── personalistika/   # Personalistika
│   ├── contracts/        # Evidence smluv
│   ├── planovani/        # Plánování výroby
│   ├── vyroba/           # Výroba
│   ├── iml/              # IML
│   ├── materialy/        # Katalog materiálů
│   ├── help/             # Zobrazení dokumentace (markdown)
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
- **[Modul IML](docs/MODUL_IML.md)** – zákazníci, produkty, poptávky, objednávky
- **[Katalog materiálů](docs/MODUL_MATERIALY.md)** – SDS/TDS, kategorie materiálů
- **[Evidence smluv](docs/MODUL_EVIDENCE_SMLOUV.md)** – workflow smluv
- **[Úkoly](docs/MODUL_UKOLY.md)** – zadávání a archiv úkolů
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
