# Kalendář – dvoufázové schvalování (2. fáze)

**Implementováno březen 2026.** Viz též hlavní dokumentace `docs/MODUL_KALENDAR.md`.

## Cíl

Rozšířit schvalovací workflow o druhý stupeň: po schválení zástupcem čeká událost na schválení vedoucím oddělení žadatele. Definitivní schválení = schválení vedoucím.

---

## Aktuální stav (1. fáze)

- **Žadatel** vytvoří událost (Dovolená/Osobní) s povinným zástupem
- **Zástup** dostane notifikaci, schválí nebo zamítne
- Při schválení: `approval_status = "approved"`, notifikace žadateli
- Při zamítnutí: `approval_status = "rejected"`, důvod žadateli

---

## Cílový stav (2 fáze)

| Fáze | Stav | Kdo schvaluje | Co se stane |
|------|------|---------------|-------------|
| 1 | `pending` | Zástup | Notifikace zástupovi |
| 2 | `deputy_approved` | Vedoucí oddělení | Po schválení zástupem → notifikace vedoucímu |
| 3 | `approved` | – | Vedoucí schválil → finální stav |
| – | `rejected` | Kdokoliv | Zamítnuto (zástup nebo vedoucí) |

---

## Databázové modely (existující)

### departments
- `manager_id` (Int?) – FK na users – vedoucí oddělení

### users
- `department_id` (Int?) – hlavní oddělení uživatele

### calendar_events
- `department_id` (Int?) – může být z formuláře; pokud null, použít `users.department_id` žadatele
- `created_by` – žadatel
- `approval_status` – rozšířit o hodnotu `deputy_approved`

### calendar_approvals
- `approval_type`: "deputy" | "manager"
- `approval_order`: 1 (zástup), 2 (vedoucí)
- Už podporuje více schvalovatelů

---

## Postup implementace

### 1. Rozšíření approval_status

**Soubor:** `prisma/schema.prisma` (žádná migrace – `approval_status` je VarChar(20), `deputy_approved` se vejde)

**Hodnoty:**
- `pending` – čeká na zástupce
- `deputy_approved` – zástup schválil, čeká na vedoucího
- `approved` – vedoucí schválil (finální)
- `rejected` – zamítnuto

---

### 2. Úprava API při schválení zástupcem

**Soubor:** `app/api/calendar/[id]/approve/route.ts`

**Logika při `action: "approve"` (zástup schválí):**

1. Zjistit oddělení žadatele:
   - `event.department_id` (pokud vyplněno)
   - jinak `users.department_id` pro `event.created_by`

2. Zjistit vedoucího oddělení:
   - `departments.manager_id` pro dané oddělení

3. Pokud **existuje vedoucí** (`manager_id` není null):
   - Nastavit `approval_status = "deputy_approved"` (ne "approved")
   - Přidat poznámku do popisu: „Schváleno zástupem dne … (jméno zástupce)“
   - Aktualizovat `calendar_approvals` pro deputy (status=approved)
   - Vytvořit nový záznam v `calendar_approvals`:
     - `event_id`, `approver_id = manager_id`, `approval_type = "manager"`, `approval_order = 2`, `status = "pending"`
   - Odeslat notifikaci **vedoucímu**:
     - title: „Událost čeká na schválení“
     - message: „[Zástup] schválil/a událost „[název]“ od [žadatel]. Událost čeká na vaše schválení.“
     - link: `/calendar/[id]`
   - Odeslat notifikaci **žadateli**:
     - title: „Událost schválena zástupem“
     - message: „[Zástup] schválil/a vaši událost „[název]“. Čeká na schválení vedoucím oddělení.“

4. Pokud **vedoucí neexistuje** (oddělení nemá manager_id):
   - Chovat se jako dnes: `approval_status = "approved"` (finální schválení)
   - Notifikace žadateli: „Událost schválena“

---

### 3. Nový endpoint pro schválení vedoucím

**Možnosti:**

**A) Rozšířit stávající `POST /api/calendar/[id]/approve`**

- Rozlišit, kdo volá: `deputy_id === userId` → logika zástupce; `manager_id === userId` → logika vedoucího
- Při volání vedoucím: kontrola, že `approval_status === "deputy_approved"` a že volající je vedoucí oddělení žadatele

**B) Samostatný endpoint** `POST /api/calendar/[id]/approve-manager` (volitelné)

Doporučení: **A** – jeden endpoint, rozlišení podle role volajícího.

**Logika při schválení vedoucím:**
- Ověřit: `approval_status === "deputy_approved"`
- Ověřit: volající je `departments.manager_id` pro oddělení žadatele
- Nastavit `approval_status = "approved"`
- Aktualizovat `calendar_approvals` pro manager (status=approved, approved_at)
- Doplnit popis: „Schváleno vedoucím dne … (jméno vedoucího)“
- Notifikace žadateli: „Vaše událost „[název]“ byla definitivně schválena.“

**Logika při zamítnutí vedoucím:**
- Stejně jako u zástupce: `approval_status = "rejected"`, důvod, notifikace žadateli

---

### 4. Úprava detailu události – tlačítka pro vedoucího

**Soubor:** `app/(dashboard)/calendar/[id]/page.tsx`

**Podmínky zobrazení tlačítek Schválit/Zamítnout:**
- **Zástup:** `deputy_id === userId` AND `approval_status === "pending"`
- **Vedoucí:** `approval_status === "deputy_approved"` AND `userId === manager_id` oddělení žadatele

**Implementace:**
- Načíst vedoucího: `event.departments?.manager_id` nebo z `users.department_id` žadatele → `departments.manager_id`
- Předat do `ApproveRejectButtons` nebo vytvořit sdílenou komponentu s parametrem `approverType: "deputy" | "manager"`
- API rozliší podle toho, kdo volá

---

### 5. Zobrazení stavů v kalendáři a detailu

**Soubor:** `app/(dashboard)/calendar/WeekCalendarGrid.tsx`

- `pending` → štítek „Čeká na schválení“ (žluto-oranžový)
- `deputy_approved` → nový štítek „Čeká na vedoucího“ (např. modrý nebo oranžový)
- `approved` → štítek „Schváleno“ (červený/zelený)
- `rejected` → (volitelně) štítek „Zamítnuto“

**Soubor:** `app/(dashboard)/calendar/[id]/page.tsx`

- Rozšířit zobrazení stavu schválení o „Čeká na vedoucího“ pro `deputy_approved`

---

### 6. Zobrazení událostí vedoucímu

**Soubor:** `app/(dashboard)/calendar/page.tsx`

- V záložce „Osobní kalendář“ (`scope=mine`) vedoucí vidí i události, kde je vedoucím oddělení žadatele a `approval_status === "deputy_approved"`
- Rozšířit `where` podmínku: `OR: [{ created_by: userId }, { deputy_id: userId }, { /* vedoucí – viz níže */ }]`

**Problém:** `calendar_events` nemá `manager_id`. Vedoucího zjistíme přes:
- Události s `department_id` = oddělení, kde `manager_id = userId`
- Události, kde žadatel (`created_by`) má `department_id` = oddělení s `manager_id = userId`

**Implementace:** Složitější dotaz – načíst ID oddělení, kde je uživatel vedoucím, pak události kde `(event.department_id IN deptIds) OR (creator.department_id IN deptIds)`.

Alternativa: načíst události v rozsahu a filtrovat na frontu – méně efektivní.

Lepší: rozšířit Prisma dotaz – include `users` (created_by) s `department_id`, načíst oddělení kde `manager_id = userId`, filtrovat události kde `department_id` nebo `users.department_id` je v tomto seznamu. Nebo raw SQL / více dotazů.

**Prakticky:** 
1. Načíst `departmentIds` = oddělení kde `manager_id = userId`
2. `where: { OR: [..., { department_id: { in: departmentIds } }, { users: { department_id: { in: departmentIds } } }] }` – ale to vyžaduje include users v where, což Prisma umí.

---

### 7. Zajištění department_id při vytváření události

**Soubor:** `app/api/calendar/route.ts` (POST)

- Pokud `department_id` není v body, doplnit z `users.department_id` žadatele
- Zajistí, že u událostí bez explicitního oddělení máme vždy oddělení žadatele

---

### 8. Edge cases

| Situace | Řešení |
|---------|--------|
| Oddělení nemá vedoucího | Zástup schválí → rovnou `approved`, notifikace žadateli |
| Žadatel nemá oddělení | Stejně – rovnou `approved` |
| Událost nemá department_id a žadatel nemá department_id | Rovnou `approved` |
| Vedoucí = žadatel | Povolit – vedoucí schvaluje sám sobě (nebo zakázat a považovat za auto-schváleno) |
| Vedoucí = zástup | Možné – dva záznamy v calendar_approvals |

---

## Pořadí implementace

1. **API approve** – rozšířit logiku pro deputy (deputy_approved + notifikace vedoucímu)
2. **API approve** – přidat logiku pro manager (schválení/zamítnutí vedoucím)
3. **Detail události** – tlačítka pro vedoucího, rozšíření stavů
4. **Kalendář** – štítek „Čeká na vedoucího“, zobrazení událostí vedoucímu v Osobním kalendáři
5. **Vytvoření události** – doplnění `department_id` z žadatele, pokud chybí
6. **Testování** – všechny kombinace (s/bez vedoucího, s/bez oddělení)

---

## Soubory k úpravě

| Soubor | Změny |
|-------|-------|
| `app/api/calendar/[id]/approve/route.ts` | Dvoufázová logika, rozlišení deputy vs manager |
| `app/(dashboard)/calendar/[id]/page.tsx` | Tlačítka pro vedoucího, stavy deputy_approved |
| `app/(dashboard)/calendar/ApproveRejectButtons.tsx` | Podpora pro manager (volitelně stejná komponenta) |
| `app/(dashboard)/calendar/WeekCalendarGrid.tsx` | Štítek „Čeká na vedoucího“ |
| `app/(dashboard)/calendar/page.tsx` | Zobrazení událostí čekajících na vedoucího v Osobním kalendáři |
| `app/api/calendar/route.ts` | Doplnění department_id z žadatele |
