# Modul Úkoly (`ukoly`) – dokumentace

Modul slouží k zadávání a sledování úkolů v aplikaci INTEGRAF. Uživatelé s oprávněním **write** zadávají úkoly; s oprávněním **read** vidí úkoly, které se jich týkají. Úkol lze přiřadit **konkrétnímu uživateli** a/nebo **jednomu či více oddělením**. Po vytvoření nebo po **změně termínu splnění** systém odešle **notifikaci** (centrum v hlavičce) a **e-mail** všem příjemcům dle pravidel níže.

**Jednotný klíč modulu v `module_access`:** `ukoly` (hodnoty `read` / `write` / `admin` stejně jako u jiných modulů).

---

## Role a oprávnění

| Úroveň | Typická role | Co umožňuje |
|--------|----------------|-------------|
| `ukoly: read` | úkolovaný (zaměstnanec) | přehled relevantních úkolů, detail, zobrazení v kalendáři |
| `ukoly: write` | zadavatel úkolů | vše z `read` + vytváření úkolů, úprava/smazání **vlastních** zadaných úkolů |
| Admin | role `admin` | plný přístup jako u ostatních modulů |

Viditelnost úkolu v přehledu API:

- tvůrce (`created_by`),
- přiřazený uživatel (`assignee_user_id`),
- člen kteréhokoli z oddělení uvedených u úkolu (primární `users.department_id` nebo záznam v `user_secondary_departments`).

---

## Funkce (MVP)

- **Zadání úkolu:** text úkolu, číslo zakázky, termín splnění (datum + čas), příznak „urgent“ (splnit obratem), volitelný **příjemce (uživatel)**, **zaškrtnutí oddělení** (M:N), příloha (Word/Excel/PDF/JPG – viz API).
- **Přehled zadaných úkolů** (`/ukoly`) + **Archiv** (`/ukoly/archive`).
- **Detail** (`/ukoly/[id]`).
- **Statistiky** (`/ukoly/stats`) – zatím zástupná stránka.
- **Kalendář:** úkoly se zobrazují v mřížce spolu s událostmi; odkaz vede na detail úkolu. V týdenním pohledu jako průběžná červená linka od data zadání do termínu.
- **Notifikace a e-mail** při přidělení (nový úkol) a při **změně `due_at`**.
- **Potvrzení rozpracování a splnění** na detailu úkolu.

Schvalovací workflow **není** – stačí přiřazení a upozornění.

Stavy:

- `open` – nový úkol,
- `in_progress` – rozpracovaný (po potvrzení),
- `done` – splněný (archiv),
- `cancelled` – zrušený (archiv).

---

## Pravidla přiřazení a příjemci upozornění

1. **Musí být vyplněn alespoň jeden** z: přiřazený uživatel **nebo** alespoň jedno oddělení.
2. **Sdílená položka v kalendáři:** úkol přiřazený oddělením (s nebo bez konkrétního uživatele) se v kalendáři chová jako **jedna sdílená položka** (stejný termín, stejný text v buňce) pro všechny oprávněné pohledy.
3. **Osobní kalendář:** u úkolu **jen na oddělení** (bez `assignee_user_id`) se úkol **zobrazí ve všech osobních kalendářích členů** dotčených oddělení. U úkolu s vyplněným přiřazeným uživatelem se kromě toho logicky zobrazí i u něj (a u členů oddělení, pokud jsou oddělení vyplněna).
4. Při **vytvoření** a při **změně termínu** (`due_at`) dostane každý cílový uživatel **notifikaci** (`type`: `ukoly_assigned` nebo `ukoly_deadline_changed`) a **e-mail** (pokud je SMTP zapnuté), s odkazem na `/ukoly/[id]`.

**Množina příjemců notifikací/e-mailů:**

- je-li vyplněn `assignee_user_id`: vždy tento uživatel (pokud je aktivní);
- pro každé přiřazené oddělení: všichni **aktivní** uživatelé, jejichž primární nebo sekundární oddělení odpovídá;
- sjednocení bez duplicit (jeden uživatel jedna zpráva).

---

## Kalendář

- Používá se **Globální** a **Osobní** pohled.
- Režim „Kalendář oddělení“ je aktuálně deaktivovaný.
- Úkoly v osobním pohledu se propisují uživatelům, kterých se týkají (přiřazený uživatel a členové zadaných oddělení).
- V týdenním pohledu je úkol zobrazen jako průběžná červená linka se šipkou od data zadání (`assigned_at`) do termínu (`due_at`), s omezeným počtem popisků (začátek/konec/střed).

---

## Databázové modely (Prisma)

### `ukoly`

| Pole | Typ | Popis |
|------|-----|--------|
| id | Int | PK |
| body | Text | Zadaný úkol (popis) |
| order_number | String? | Zakázka / číslo |
| assigned_at | DateTime | Datum zadání (výchozí now) |
| due_at | DateTime | Termín splnění |
| urgent | Boolean | Splnit obratem |
| assignee_user_id | Int? | FK users |
| created_by | Int | FK users (zadavatel) |
| attachment_path | String? | Relativní cesta k souboru |
| attachment_original_name | String? | Původní název souboru |
| status | String | `open`, `in_progress`, `done`, `cancelled` |
| created_at, updated_at | DateTime | |

### `ukoly_departments`

| Pole | Typ | Popis |
|------|-----|--------|
| ukol_id | Int | FK `ukoly` |
| department_id | Int | FK `departments` |
| (composite PK) | | `(ukol_id, department_id)` |

---

## API

| Metoda | Cesta | Oprávnění | Popis |
|--------|--------|-----------|--------|
| GET | `/api/ukoly` | `read` | Seznam úkolů dle viditelnosti |
| POST | `/api/ukoly` | `write` | Vytvoření (multipart: pole + soubor) |
| GET | `/api/ukoly/[id]` | `read` | Detail |
| PUT | `/api/ukoly/[id]` | `write` | Úprava (JSON); při změně `due_at` notifikace + mail |
| DELETE | `/api/ukoly/[id]` | `write` | Smazání; pouze tvůrce |

---

## Soubory (orientační)

```
app/(dashboard)/ukoly/
  layout.tsx
  page.tsx              # přehled
  new/page.tsx          # nový úkol
  [id]/page.tsx         # detail
  stats/page.tsx        # statistiky (placeholder)

app/api/ukoly/
  route.ts
  [id]/route.ts

lib/ukoly-recipients.ts   # členové oddělení, sjednocení příjemců
lib/ukoly-notify.ts       # notifikace + volání e-mailu
lib/ukoly-calendar.ts     # mapování úkolů na položky kalendářové mřížky

public/uploads/ukoly/     # nahrané přílohy
```

Zobrazení v kalendáři: rozšíření `app/(dashboard)/calendar/page.tsx`, `CalendarTabs.tsx`, `WeekCalendarGrid.tsx`, `MonthCalendarGrid.tsx`, případně `CalendarListView.tsx`.

---

## Konfigurace rolí (příklad `module_access`)

Zadavatel:

```json
{ "ukoly": "write", "calendar": "read" }
```

Úkolovaný:

```json
{ "ukoly": "read", "calendar": "read" }
```

Kalendář oddělení vyžaduje přístup k modulu **kalendář** (`calendar`: `read`) a členství v příslušném oddělení.

---

## Chování úkolu v kalendářové mřížce

- Položka má typově barvu odlišnou od běžných událostí (např. modrá).
- Úkoly **nelze** přetahovat (drag & drop) jako události kalendáře.
- Klik vede na `/ukoly/[id]`, nikoli na `/calendar/[id]`.

Interně se předává flag `ukoly_task_id` na sloučené položce události v UI.
