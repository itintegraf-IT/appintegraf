# Modul Kalendář – dokumentace

Modul kalendáře slouží ke správě událostí a termínů v aplikaci INTEGRAF. Nabízí týdenní zobrazení s mřížkou dnů × hodin, filtry a export do formátu iCalendar (.ics).

## Přehled funkcí

- **Týdenní zobrazení** – mřížka s dny v týdnu (po–ne) a hodinovými sloty (0–23)
- **Řádek „Celý den“** – pro celodenní události
- **Navigace** – předchozí/další týden, posun o den, návrat na aktuální týden
- **Filtry** – Globální kalendář (všechny události) / Osobní kalendář (jen moje)
- **CRUD událostí** – vytvoření, zobrazení detailu, úprava
- **Vytvoření kliknutím** – kliknutí do mřížky (buňka dne × hodiny nebo řádek „Celý den“) otevře modal s předvyplněným datem a časem
- **Export .ics** – stažení kalendáře pro import do Outlook, Google Calendar atd.

---

## Struktura souborů

```
app/(dashboard)/calendar/
├── page.tsx              # Hlavní stránka kalendáře
├── add/page.tsx          # Přidání nové události
├── [id]/page.tsx         # Detail události
├── [id]/edit/page.tsx    # Úprava události
├── CalendarNav.tsx       # Navigace mezi týdny (client)
├── CalendarTabs.tsx       # Záložky filtrů Globální/Osobní (client)
├── WeekCalendarGrid.tsx  # Týdenní mřížka dnů × hodin (client)
├── CreateEventModal.tsx   # Modal pro vytvoření události po kliknutí do mřížky (client)
└── lib/
    ├── week-utils.ts     # Pomocné funkce pro práci s týdny
    └── event-types.ts    # Typy událostí (Dovolená, Osobní, …)

app/api/calendar/
├── route.ts              # GET (seznam), POST (vytvoření)
├── [id]/route.ts         # GET (detail), PUT (úprava)
└── export/route.ts       # GET – export .ics
```

---

## Komponenty

### CalendarNav

Navigace v kalendáři:

- **«** – předchozí týden
- **<** – o den zpět
- **>** – o den vpřed
- **»** – další týden
- **Nyní** – návrat na aktuální týden

Používá URL parametry `from` a `to` (YYYY-MM-DD) pro rozsah zobrazeného týdne.

### CalendarTabs

Přepínání mezi pohledy:

- **Globální kalendář** – všechny události
- **Osobní kalendář** – jen události vytvořené přihlášeným uživatelem (`created_by`)

Používá URL parametr `scope` (`all` | `mine`).

### WeekCalendarGrid

Týdenní mřížka:

- **Hlavička** – sloupce pro jednotlivé dny (po 16. 3., út 17. 3., …)
- **Řádek „Celý den“** – pro události s délkou ≥ 24 h nebo začínající v 00:00
- **Hodinové řádky** – 0–23
- **Události** – umístěné podle času začátku a délky
- **Zvýraznění dnešního dne** – světle žluté pozadí
- **Události** – barevné bloky s odkazem na detail; vícedenní události se zobrazují ve všech dnech, které pokrývají
- **Kliknutí do mřížky** – buňka (den × hodina) nebo řádek „Celý den“ otevře modal pro vytvoření události s předvyplněným datem a časem

---

## API endpointy

| Metoda | Endpoint | Popis |
|--------|----------|-------|
| GET | `/api/calendar` | Seznam událostí. Parametry: `from`, `to` (YYYY-MM-DD) |
| POST | `/api/calendar` | Vytvoření události |
| GET | `/api/calendar/[id]` | Detail události |
| PUT | `/api/calendar/[id]` | Úprava události |
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
| requires_approval | Boolean? | *(zatím nepoužito)* |
| approval_status | String? | *(zatím nepoužito)* |

### Zástup (deputy_id) – schvalovací workflow

U typů **Dovolená** a **Osobní** je pole **Zástup** povinné. Zástupem může být pouze uživatel ze stejného hlavního oddělení nebo ze stejných sekundárních oddělení jako tvůrce události.

- API endpoint: `GET /api/calendar/deputies` – vrací seznam možných zástupců
- Validace na API: pro `dovolena` a `osobni` je `deputy_id` povinné a musí být z povoleného seznamu

**Při uložení události s zástupem:**
1. Nastaví se `requires_approval=true`, `approval_status=pending`
2. Vytvoří se záznam v `calendar_approvals` (approver_id = deputy_id)
3. Zástup obdrží **notifikaci** v aplikaci (ikona zvonku v headeru)
4. Událost se zobrazí zástupovi v kalendáři s indikátorem **„Čeká na schválení“**
5. V záložce „Osobní kalendář“ zástup vidí i události, u kterých je zástupem

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

1. **Přechod z měsíčního na týdenní zobrazení**
   - Místo tabulky seznamu událostí je nyní mřížka dnů × hodin
   - Týden = pondělí–neděle (český standard)

2. **Přidání CalendarNav**
   - Navigace « < > » a tlačítko „Nyní“
   - Používá `getWeekStart`, `getWeekEnd`, `getPrevWeek`, `getNextWeek` z `lib/week-utils.ts`

3. **Přidání CalendarTabs**
   - Globální kalendář / Osobní kalendář
   - URL parametr `scope`

4. **Přidání WeekCalendarGrid**
   - Mřížka s řádkem „Celý den“ a hodinovými sloty 0–23
   - Události s absolutním pozicováním podle času
   - Rozpoznání celodenních událostí (start 00:00, délka ≥ 24 h)

5. **Vytvoření události kliknutím do mřížky**
   - CreateEventModal – modal s formulářem pro novou událost
   - Kliknutí na buňku (den × hodina) předvyplní začátek a konec (+1 h)
   - Kliknutí na řádek „Celý den“ předvyplní celodenní událost (00:00–23:59)
   - Kliknutí na existující událost vede na detail (stopPropagation)

6. **Přidání lib/week-utils.ts**
   - `getWeekStart()`, `getWeekEnd()`
   - `getPrevWeek()`, `getNextWeek()`, `getCurrentWeek()`
   - `formatWeekRange()`

### URL parametry stránky

- `from` – začátek týdne (YYYY-MM-DD)
- `to` – konec týdne (YYYY-MM-DD)
- `scope` – `all` (výchozí) | `mine`

Příklad: `/calendar?from=2026-03-16&to=2026-03-22&scope=mine`
