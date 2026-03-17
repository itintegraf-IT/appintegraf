# Modul Kalendář – dokumentace

Modul kalendáře slouží ke správě událostí a termínů v aplikaci INTEGRAF. Nabízí týdenní i měsíční zobrazení, dvoufázové schvalování (zástup → vedoucí oddělení), drag & drop přesun událostí a export do formátu iCalendar (.ics).

## Přehled funkcí

- **Týdenní zobrazení** – mřížka s dny v týdnu (po–ne) a hodinovými sloty (0–23)
- **Měsíční zobrazení** – přehled celého měsíce v mřížce 6 týdnů
- **Řádek „Celý den“** – pro celodenní události (týdenní pohled)
- **Navigace** – předchozí/další týden nebo měsíc, posun o den (týden), návrat na aktuální období
- **Filtry** – Globální kalendář (všechny události) / Osobní kalendář (jen moje)
- **CRUD událostí** – vytvoření, zobrazení detailu, úprava, **mazání**
- **Vytvoření kliknutím** – kliknutí do mřížky otevře modal s předvyplněným datem a časem
- **Drag & drop** – přesun vlastních událostí přetažením; u dovolené/osobní reset schválení
- **Dvoufázové schvalování** – zástup schválí → vedoucí oddělení schválí (definitivní)
- **Notifikace** – na dashboardu i v headeru (zvoneček); události ke schválení na dashboardu
- **Export .ics** – stažení kalendáře pro import do Outlook, Google Calendar atd.

---

## Struktura souborů

```
app/(dashboard)/calendar/
├── page.tsx              # Hlavní stránka kalendáře
├── add/page.tsx          # Přidání nové události
├── [id]/page.tsx         # Detail události
├── [id]/edit/page.tsx    # Úprava události
├── CalendarNav.tsx       # Navigace mezi týdny/měsíci (client)
├── CalendarTabs.tsx      # Záložky filtrů Globální/Osobní (client)
├── CalendarViewToggle.tsx # Přepínač Týden/Měsíc (client)
├── WeekCalendarGrid.tsx  # Týdenní mřížka dnů × hodin (client)
├── MonthCalendarGrid.tsx # Měsíční mřížka (client)
├── CreateEventModal.tsx  # Modal pro vytvoření události (client)
├── ApproveRejectButtons.tsx # Tlačítka Schválit/Zamítnout (client)
├── DeleteEventButton.tsx # Tlačítko Smazat s potvrzením (client)
├── ConfirmMoveModal.tsx  # Potvrzení přesunu události (client)
└── lib/
    ├── week-utils.ts     # Pomocné funkce pro práci s týdny
    ├── month-utils.ts    # Pomocné funkce pro měsíční zobrazení
    └── event-types.ts    # Typy událostí (Dovolená, Osobní, …)

app/api/calendar/
├── route.ts              # GET (seznam), POST (vytvoření)
├── [id]/route.ts         # GET (detail), PUT (úprava), DELETE (mazání)
├── [id]/approve/route.ts # POST – schválení/zamítnutí (zástup nebo vedoucí)
├── [id]/move/route.ts    # PATCH – přesunutí události
├── deputies/route.ts     # GET – seznam možných zástupců
└── export/route.ts       # GET – export .ics
```

---

## Komponenty

### CalendarNav

Navigace v kalendáři (závisí na zobrazení):

**Týdenní pohled:**
- **«** – předchozí týden
- **<** – o den zpět
- **>** – o den vpřed
- **»** – další týden
- **Nyní** – návrat na aktuální týden

**Měsíční pohled:**
- **<** – předchozí měsíc
- **>** – další měsíc
- **Nyní** – aktuální měsíc

### CalendarViewToggle

Přepínač zobrazení:
- **Týden** – týdenní mřížka s hodinami
- **Měsíc** – měsíční přehled (6 týdnů)

URL parametr `view` (`week` | `month`), pro měsíc též `month` (YYYY-MM).

### CalendarTabs

Přepínání mezi pohledy:
- **Globální kalendář** – všechny události
- **Osobní kalendář** – události uživatele, události kde je zástupem, události čekající na schválení vedoucím

URL parametr `scope` (`all` | `mine`).

### WeekCalendarGrid

Týdenní mřížka:
- **Hlavička** – sloupce pro jednotlivé dny (po 16. 3., út 17. 3., …)
- **Řádek „Celý den“** – pro celodenní události
- **Hodinové řádky** – 0–23
- **Události** – barevné bloky s odkazem na detail; vícedenní události ve všech dnech
- **Štítky stavu** – Čeká na schválení (žlutý), Čeká na vedoucího (modrý), Schváleno (červený)
- **Drag & drop** – tvůrce může přetahovat své události na nové datum/čas
- **Kliknutí** – buňka otevře modal pro novou událost, událost vede na detail

### MonthCalendarGrid

Měsíční mřížka:
- **6 týdnů** (pondělí–neděle)
- **Dny mimo měsíc** – šedé pozadí
- **Dnešní den** – červené zvýraznění
- **Události** – max. 3 na den, odkaz na detail; indikátory schválení
- **Kliknutí na den** – modal pro novou celodenní událost

---

## API endpointy

| Metoda | Endpoint | Popis |
|--------|----------|-------|
| GET | `/api/calendar` | Seznam událostí. Parametry: `from`, `to` (YYYY-MM-DD) |
| POST | `/api/calendar` | Vytvoření události |
| GET | `/api/calendar/[id]` | Detail události |
| PUT | `/api/calendar/[id]` | Úprava události |
| DELETE | `/api/calendar/[id]` | Smazání události (jen tvůrce). Notifikace schvalovatelům. |
| POST | `/api/calendar/[id]/approve` | Schválení/zamítnutí. Body: `{ action: "approve"|"reject", comment?: string }` |
| PATCH | `/api/calendar/[id]/move` | Přesunutí události. Body: `{ start_date, end_date, all_day? }` |
| GET | `/api/calendar/export` | Export .ics. Parametr: `scope=all` | `mine` (admin může `all`) |
| GET | `/api/calendar/deputies` | Seznam možných zástupců (z hlavního + sekundárních oddělení) |

### Vytvoření/úprava události (body)

```json
{
  "title": "Název události",
  "description": "Popis",
  "start_date": "2026-03-16T09:00:00",
  "end_date": "2026-03-16T10:00:00",
  "event_type": "dovolena|osobni|schuzka_mimo_firmu|sluzebni_cesta|lekar|nemoc|jine",
  "department_id": 1,
  "deputy_id": 5,
  "is_public": false,
  "location": "Místo",
  "color": "#DC2626"
}
```

---

## Databázové modely (Prisma)

### calendar_events

| Pole | Typ | Popis |
|------|-----|-------|
| id | Int | PK |
| title | String | Název |
| description | String? | Popis |
| start_date | DateTime | Začátek |
| end_date | DateTime | Konec |
| event_type | String? | dovolena, osobni, schuzka_mimo_firmu, sluzebni_cesta, lekar, nemoc, jine |
| created_by | Int | FK users |
| department_id | Int? | FK departments |
| deputy_id | Int? | FK users (zástup; povinné u Dovolená, Osobní) |
| is_public | Boolean? | Veřejná událost |
| color | String? | Barva (#hex) |
| location | String? | Místo |
| requires_approval | Boolean? | true, pokud je deputy_id |
| approval_status | String? | pending, deputy_approved, approved, rejected |

### Dvoufázové schvalování (deputy_id)

U typů **Dovolená** a **Osobní** je pole **Zástup** povinné. Workflow:

1. **pending** – zástup dostane notifikaci, schválí nebo zamítne
2. **deputy_approved** – zástup schválil; vedoucí oddělení žadatele dostane notifikaci
3. **approved** – vedoucí schválil (definitivní); nebo zástup schválil a oddělení nemá vedoucího
4. **rejected** – zamítnuto zástupem nebo vedoucím

- API: `GET /api/calendar/deputies` – seznam možných zástupců
- API: `POST /api/calendar/[id]/approve` – schválení/zamítnutí (zástup nebo vedoucí)
- **Dashboard** – sekce „Události ke schválení“ a „Notifikace“ (nepřečtené)

### Typy událostí (event_type)

| Hodnota v DB | Zobrazení |
|--------------|-----------|
| dovolena | Dovolená |
| osobni | Osobní |
| schuzka_mimo_firmu | Schůzka mimo firmu |
| sluzebni_cesta | Služební cesta |
| lekar | Lékař |
| nemoc | Nemoc |
| jine | Jiné |

Definice v `lib/event-types.ts`, výchozí typ: `jine`.

### calendar_approvals | calendar_event_participants

Modely v DB existují, ale zatím nejsou v UI využívány (např. pro budoucí workflow schvalování).

---

## Oprávnění

- Modul `calendar` je v `lib/auth-utils.ts` a `getLayoutAccess()`
- Přístup se kontroluje přes role (`module_access` JSON)
- Export vyžaduje `hasModuleAccess(userId, "calendar", "read")`
- API vyžaduje přihlášeného uživatele (session)

---

## Implementace (březen 2026)

### Provedené změny

1. **Týdenní zobrazení** – mřížka dnů × hodin, řádek „Celý den“, týden = po–ne

2. **Dvoufázové schvalování** – zástup → vedoucí oddělení; stavy `pending`, `deputy_approved`, `approved`, `rejected`

3. **Tlačítka Schválit/Zamítnout** – na detailu události pro zástupce a vedoucího; modal pro důvod zamítnutí

4. **Mazání událostí** – tlačítko Smazat (jen tvůrce), notifikace schvalovatelům při smazání schválené události

5. **Drag & drop** – přesun vlastních událostí v týdenním pohledu; reset schválení u dovolené/osobní

6. **Měsíční zobrazení** – přepínač Týden/Měsíc, MonthCalendarGrid, `lib/month-utils.ts`

7. **Dashboard** – sekce Události ke schválení, Notifikace (nepřečtené)

8. **Přidání lib/week-utils.ts, lib/month-utils.ts**
   - `getWeekStart()`, `getWeekEnd()`, `getPrevWeek()`, `getNextWeek()`, `getCurrentWeek()`
   - `getMonthGridStart()`, `getMonthGridEnd()`, `getPrevMonth()`, `getNextMonth()`, `formatMonth()`

### URL parametry stránky

- `view` – `week` (výchozí) | `month`
- `from` – začátek období (YYYY-MM-DD)
- `to` – konec období (YYYY-MM-DD)
- `month` – pro měsíční pohled (YYYY-MM)
- `scope` – `all` (výchozí) | `mine`

Příklady:
- `/calendar?view=week&from=2026-03-16&to=2026-03-22&scope=mine`
- `/calendar?view=month&month=2026-03&scope=all`

---

## Mazání událostí

- Tlačítko **Smazat** na detailu události (jen pro tvůrce)
- Potvrzovací modal
- Při smazání schválené události: notifikace všem schvalovatelům (z `calendar_approvals` se statusem approved)

---

## Přesun událostí (drag & drop)

- **Týdenní pohled** – tvůrce může přetahovat své události
- **Řádek „Celý den“** – přetažení na den (zachová délku u vícedenních)
- **Časová mřížka** – přetažení na buňku (zachová délku)
- **Potvrzení** – modal s novým datem/časem
- **Dovolená/Osobní** – po přesunu reset schválení na `pending`, notifikace zástupovi

---

## Dashboard

- **Události ke schválení** – události čekající na schválení (jako zástup nebo vedoucí)
- **Notifikace** – nepřečtené notifikace (aktivní, čekající na vyřízení)
