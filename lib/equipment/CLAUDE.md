# Modul Majetek (equipment) — pravidla pro Claude Code

Platí POUZE pro modul Majetek. Jeho soubory:

- `app/(dashboard)/equipment/**` — stránky a klientské komponenty (včetně `_components/`)
- `app/api/equipment/**` — REST API routes
- `lib/equipment/**` — logika modulu (QR, štítky, půdorysy, přesuny, inventura, import z Excelu)
- `lib/equipment-*.ts` — starší pomocné soubory modulu v kořeni `lib/` (postupně přesouvat do `lib/equipment/`)
- `docs/MODUL_MAJETEK_*.md` — dokumentace modulu

Modul od 10/2026 rozvíjí Vojta s Claude Code. Michal spravuje server, nasazení a sdílené soubory aplikace.

**Nezasahuj kvůli tomuto modulu do zbytku appky.** Zejména ne do `components/ui/` (globální sada), `prisma/schema.prisma`, `auth.ts`, `lib/db.ts`, `lib/auth-utils.ts`, `lib/email.ts`, `lib/backup/**`, `components/layout/Sidebar.tsx`, `app/globals.css` a do souborů jiných modulů (`projekty`, `makety`, `iml`, `stitky`, `vykresy`). Když je změna sdíleného souboru nutná, **nejdřív to řekni Vojtovi** a vysvětli proč — sdílené soubory mění i Michal a konflikty se pak řeší ručně.

## Data a API vzory

- Prisma modely mají prefix `equipment_` (`equipment_items`, `equipment_categories`, `equipment_rooms`, `equipment_assignments`, `equipment_location_history`, `equipment_requests`, `equipment_floor_plans`, `equipment_inventories`, `equipment_inventory_lines`, `equipment_qr_pool`, `equipment_user_category_access`). Uživatelé jsou sdílený model `users` (`Int` id). Tabulka `equipment_transfers` je nepoužívaná (legacy) — nepsat do ní.
- Prisma klient **vždy** přes `import { prisma } from "@/lib/db"` — modul nemá vlastního klienta.
- **Čtení:** server komponenty (`app/(dashboard)/equipment/**/page.tsx`) se dotazují Prismy přímo.
- **Mutace:** REST routes v `app/api/equipment/**` + `fetch()` z klienta a následný `router.refresh()`. Modul **nepoužívá Server Actions**, nezaváděj je.
- Každá route začíná stejnou trojicí: `const session = await auth()` → 401 `{ error: "Neautorizováno" }` → kontrola oprávnění → 403 `{ error: "Nemáte oprávnění" }`. Chybové texty jsou česky a **nikdy nevracej klientovi `e.message`** ani interní cesty — detail jen do `console.error`.
- Oprávnění **výhradně** přes `lib/equipment/access.ts` (`canReadEquipment`, `canWriteEquipment`, `canAdministerEquipment`, `getAccessibleCategories`, `isCategoryResponsible`). Nevolej v modulu přímo `isAdmin`/`hasModuleAccess` — přístup je omezený po skupinách majetku a ta logika má být jen na jednom místě. U operací nad konkrétní položkou vždy kontroluj **skupinu té položky**.
- Audit zapisuj přes `logEquipmentAuditSafe` z `lib/equipment/audit.ts`, a to **u každé mutace** (včetně přiřazení, vrácení, skenů a změn nastavení) a **se starými i novými hodnotami** změněných polí.
- Vícekrokové zápisy (přesun, přiřazení, inventura, hromadné akce) **v `prisma.$transaction`**; hromadná akce buď projde celá, nebo nic.
- Vstupy validuj (ID přes kontrolu `NaN`, délky podle limitů DB, data, ceny). Neplatný vstup = 400 s českou hláškou, nikdy neošetřená 500.

## Integrita majetku (účetní dohledatelnost)

- **Žádné tvrdé mazání položek**, které mají historii (přiřazení, přesuny, inventury). Místo mazání archivace nebo vyřazení. Historie a řádky uzavřených inventur se nesmí měnit zpětně.
- **Stav položky mění jen akce** (přiřazení, vrácení, servis, vyřazení), ne volná editace formuláře. **Místnost mění jen přesun** přes `transferEquipmentToRoom` (`lib/equipment/room-transfer.ts`), aby vznikla historie a protokol.
- Zdrojem pravdy o umístění je `room_id`. Textové pole `location` je legacy — nové funkce ho nečtou ani nezapisují.
- Inventární číslo (`asset_tag`) je vazba na účetní evidenci (SQL Ekonom, od 1. 11. 2026 ABRA Gen) — neměnit ho automaticky.

## Migrace databáze

- Modul používá **standardní `prisma migrate`**. Existující migrace: `*_equipment_requester_user_id`, `*_equipment_request_workflow_log`, `*_equipment_qr_rooms_inventory`, `*_equipment_floor_plans`, `*_equipment_item_quantity`.
- Změna schématu se dotýká sdíleného `prisma/schema.prisma` → platí pravidlo výše, **nejdřív se zeptej Vojty**. Migrace dělej idempotentní (`IF NOT EXISTS`).
- Výjimka existuje: `npm run db:equipment-quantity` (`scripts/run-equipment-quantity-migration.mjs`). Nové ruční skripty nezakládej.
- Datové opravy (např. doplnění `room_id`) jako skript s náhledem („dry run“) a výpisem změn; nejdřív lokálně, pak na testu, na produkci až se zálohou.

## UI

- Modul **nepoužívá** vendorované komponenty jako Projekty. Stránky staví na vlastních komponentách v `app/(dashboard)/equipment/` a `_components/`, Tailwind utilitách a ikonách z `lucide-react`. Před psaním nového prvku prohledej `app/(dashboard)/equipment/**` a existující komponentu použij nebo rozšiř. Nezaváděj novou UI knihovnu.
- **Nový kód používá tokeny z `app/globals.css`** (`bg-card`, `text-muted-foreground`, `border-border`, `bg-primary`, …), ne natvrdo `gray-*`/`red-*`. Stavové barvy inventury jsou v jedné konstantě — vizuální paleta modulu se vybírá (10/2026), do té doby žádné nové natvrdo zadané barvy.
- **Terénní obrazovky** (sken, inventura, přesun) jsou **mobile-first**: dotykové cíle ≥ 44 px, primární akce dosažitelné palcem, stav nikdy jen barvou (vždy i ikona a text), čitelné na slunci. Každý síťový požadavek má viditelný chybový stav.
- Texty v UI jsou české; interní kódy (`missing`, `found`, `manual`) se uživateli nikdy nezobrazují syrově.
- Soubory (fotky, přílohy) se **servírují přes API route s kontrolou oprávnění**, ne přímou cestou do `public/` (Next.js v produkci neobslouží soubory přidané po startu). Upload ověřuje typ podle obsahu souboru a příponu určuje server.

## Testy a ověřování

- Každá nová logika (oprávnění, rozpoznání kódu, inventura, přesuny, štítky) má unit test ve Vitestu vedle souboru (`*.test.ts`). Spuštění: `npx vitest run lib/equipment`.
- Po změně vždy `npx tsc --noEmit` a testy modulu.
- Změnu, která generuje PDF (štítky, protokoly, soupisy), nebo mobilní obrazovku ověř i v běžící appce (Playwright, mobilní viewport 390×844).
- Commity malé a tematicky čisté (jedna změna = jeden commit), ne desítky souborů najednou.

## Provoz a bezpečnost

- **Repozitář je veřejný.** Nikdy do něj nedávej hesla, klíče, dumpy databáze, osobní údaje ani popisy neopravených bezpečnostních slabin. Konfigurace patří do `.env` na serveru.
- Dev server Vojty typicky běží na portu 3000. **Nikdy neukončuj procesy podle jména** (`pkill`, `killall`) — zužuj na konkrétní PID a nejdřív se zeptej.
- Lokální databáze: `appintegraf_test` v AMPPS (kopie testovací DB ze serveru, reálná firemní data — nikam je nenahrávej). E-maily jsou v ní vypnuté (`system_settings.email_enabled=false`); po každém novém importu dumpu je znovu vypni.
- E-maily v šablonách vždy escapuj (uživatelský vstup nesmí jít do HTML syrově). Hromadné akce posílají jednu souhrnnou notifikaci, ne jednu za položku.
