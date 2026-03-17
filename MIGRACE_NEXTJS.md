# Plán migrace INTEGRAF z PHP na Next.js

## Přehled

Migrace původní PHP aplikace INTEGRAF na Next.js s App Router. Oprávnění podle rolí a modulů (`module_access`), autentizace přes NextAuth (credentials, bcrypt).

## Fáze migrace

### Fáze 0 – Základní infrastruktura (dokončeno)

- [x] Next.js projekt s App Router
- [x] Prisma + MariaDB
- [x] NextAuth (credentials, bcrypt, JWT)
- [x] Layout (Header, Sidebar)
- [x] Ochrana rout v layoutu (přesměrování nepřihlášených na /login)
- [x] `lib/auth-utils.ts` – `hasModuleAccess`, `isAdmin`, `getLayoutAccess`
- [x] API health check

### Fáze 1 – Základní moduly (dokončeno)

- [x] Dashboard
- [x] Kontakty (CRUD, import, export)
- [x] Majetek (vybavení, kategorie, přiřazení)
- [x] Kalendář (týdenní/měsíční zobrazení, CRUD, schvalování, export .ics)
- [x] Telefonní seznam (přihlášený + veřejný)
- [x] Požadavek na techniku (veřejný formulář)
- [x] Kiosk
- [x] Školení (testy, materiály)
- [x] Plánování výroby (bloky, codebook, dny firmy)
- [x] Admin (uživatelé, oddělení, role, reporty)

### Fáze 2 – Rozšíření (plánované)

- [ ] Další moduly z původní PHP aplikace
- [ ] Rozšíření kalendáře (participanti, opakování)
- [ ] Nový modul IML (zákazníci, objednávky, produkty) – viz `docs/Readme_IML.md`

## Oprávnění

- Moduly: `contacts`, `equipment`, `calendar`, `kiosk`, `training`, `planovani`
- Role `admin` má přístup ke všem modulům
- `module_access` v JSON: `{ "contacts": "read", "equipment": "write", ... }` nebo pole `["contacts", "calendar.read", ...]`

## Databáze

- Databáze `appintegraf` – introspected z existující PHP aplikace
- Migrace dat: `npm run migrate:planovani` – přenos z igvyroba do appintegraf
