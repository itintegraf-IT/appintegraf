# Modul Projekty — pravidla pro Claude Code

Platí POUZE pro modul Projekty (`app/(dashboard)/projekty/`, `app/api/projekty/`, `components/projekty/`, `lib/projekty/`, `hooks/projekty/`). Nezasahuj kvůli modulu do zbytku appky — zejména ne do `components/ui/` (globální sada) a do sdílených souborů (`app/globals.css`, `auth.ts`, `lib/db.ts`) bez výslovné dohody s Vojtou.

Podklad pro redesign a roadmapu: `docs/MODUL_PROJEKTY_REDESIGN_RESEARCH.md`.

## UI komponenty

- Vždy použij existující komponenty z `components/projekty/ui/` (30 vendorovaných shadcn/Radix komponent, `cn` z `@/lib/projekty/utils`). Žádné generické custom prvky, žádné přidávání nových UI knihoven.
- Dialogy a popovery na mobilu: `responsive-dialog.tsx` / `responsive-popover.tsx` (mění se na sheet/drawer).
- Toasty: `sonner` (u destruktivních akcí vždy s akcí „Zpět"). Command palette: `cmdk`. Ikony: `lucide-react`. Drag & drop: `@dnd-kit` + sensory z `lib/projekty/dnd-sensors.ts`.

## Design tokeny a vizuální jazyk

- POUZE standardní tokeny z `app/globals.css`: `bg-card`, `bg-background`, `text-muted-foreground`, `border-border`, `--primary`, badge paleta atd.
- **ZÁKAZ**: `--notion-canvas`, `--notion-fg`, `--notion-surface`, `--shadow-card`, `--shadow-card-hover`, `--info` — nikde nejsou definované (historická chyba, probíhá migrace 27 souborů). Nové výskyty nevytvářet, při úpravě souboru staré výskyty migrovat na standardní tokeny.
- Vizuální jazyk („Linear škola"):
  - border jako klidový stav karet, stín jen na hover (`hover:shadow-sm`) a drag; radius umírněně (`rounded-lg` karty, `rounded-md` chipy)
  - typografická škála: UI/seznamy `text-[13px]`, text `text-sm`, sekční nadpis `text-sm font-semibold`, titulek `text-lg font-semibold tracking-tight`; čísla `tabular-nums`
  - plná sytost barev jen pro statusy, priority a urgentní termíny; dark mode chipy `bg-{barva}-500/15 text-{barva}-400`
  - transitions 150 ms (`transition-colors duration-150`, `motion-reduce:transition-none`), akce řádků/karet `opacity-0 group-hover:opacity-100`
  - skeleton místo spinnerů pro načítání pohledů; empty states přes `components/projekty/ui/empty-state.tsx` (česky, s CTA)

## Data a API vzory

- Prisma modely s prefixem `projekty_`; uživatelé = sdílený model `users` (Int id) přes pojmenované relace. Prisma klient výhradně přes `lib/projekty/prisma.ts` (audit extension `withAudit`).
- **Migrace NE přes `prisma migrate`** — ruční SQL soubor v `prisma/migrations/` + spuštění `npm run db:projekty-migrate` (`scripts/run-projekty-migration.mjs`).
- Čtení: RSC (async server components, přímé Prisma dotazy). Mutace: REST routes v `app/api/projekty/**` + `fetch()` z klienta + `router.refresh()`; žádné Server Actions (drž konzistenci).
- Každá route: Zod schéma v `lib/projekty/validators/`, wrapper `withApiError` (`lib/projekty/api-utils.ts`), oprávnění přes `lib/projekty/rbac.ts` / `board-rbac.ts` (preferuj `canViewCard`/`canEditCard` před `canAccessParent`), session přes `lib/projekty/session.ts`.
- Notifikace: `lib/projekty/notify.ts` (sdílená tabulka `notifications` — jen přidávat typy `projekty_*`, neměnit chování ostatních modulů).

## Provoz

- Dev server Vojty typicky běží na portu 3000 — nikdy nezabíjet procesy podle jména.
- Produkci nasazuje Michal; commity držet v modulových souborech, sdílené soubory měnit jen po dohodě.
