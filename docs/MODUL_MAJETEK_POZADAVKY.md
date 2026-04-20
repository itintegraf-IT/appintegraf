# Majetek – schvalovací proces požadavků na techniku

Dokumentace workflow požadavků v modulu Majetek (záložka **Požadavky**).

## Účel

Zaměstnanci (i externí osoby bez přístupu do aplikace) mohou přes veřejný formulář odeslat požadavek na novou / dodatečnou techniku. Požadavek prochází dvoufázovým schvalováním:

1. **Stanovisko IT** (oddělení „IT")
2. **Schválení vedení** (oddělení „Vedení")

Po finálním rozhodnutí je požadavek označen jako schválený nebo zamítnutý.

## Aktéři (role)

| Role | Zdroj | Přístup | Co dělá |
|---|---|---|---|
| **Žadatel** | kdokoli | Veřejná stránka `/public/equipment-request` – bez přihlášení | Vyplní a odešle požadavek |
| **IT** | Uživatel s oprávněním `equipment:write` (Editor/Admin modulu), zároveň člen **oddělení „IT"** (hlavní nebo sekundární) | Záložka `Majetek → Požadavky` | Doplní technické stanovisko a vybere schvalovatele z Vedení |
| **Vedení** | Uživatel s oprávněním `equipment:write`, zároveň člen **oddělení „Vedení"** (hlavní nebo sekundární) | Záložka `Majetek → Požadavky` | Schválí nebo zamítne požadavek (pouze ten, který mu byl IT přímo přidělen) |

Oddělení **IT** a **Vedení** musí existovat v `Administrace → Oddělení` a mít stav *aktivní*. Kontrola probíhá na straně serveru, nelze obejít.

## Stavy (status)

Databázový enum `equipment_requests_status` → zobrazovaný text:

| Interní kód | Popis | Význam |
|---|---|---|
| `nov_` | nový | Právě odeslán, čeká na stanovisko IT |
| `cek_na_schv_len_` | čeká na schválení | IT dalo stanovisko, čeká na rozhodnutí Vedení |
| `schv_leno` | schváleno | Vedení schválilo → IT může pořídit/vydat |
| `zam_tnuto` | zamítnuto | Vedení zamítlo, konec procesu |
| `odlo_eno` | odloženo | Ruční stav (zatím se v UI nenastavuje automaticky) |
| `vy__zeno` | vyřízeno | IT označí po fyzickém dodání/předání techniky |

## Priorita

Enum `equipment_requests_priority`: `n_zk_` (nízká), `st_edn_` (střední, výchozí), `vysok_` (vysoká). Priorita je pouze informativní – neovlivňuje workflow ani automatickou eskalaci.

## Datový model (tabulka `equipment_requests`)

Klíčová pole pro schvalování:

| Pole | Typ | Význam |
|---|---|---|
| `status` | enum | Aktuální fáze (viz výše) |
| `it_response` | text | Stanovisko IT |
| `it_response_by` | FK → users | Kdo z IT psal stanovisko |
| `it_response_at` | datum | Kdy |
| `approval_requested_to` | FK → users | Kterému konkrétnímu schvalovateli z Vedení byl požadavek předán |
| `approval_requested_at` | datum | Kdy byl předán |
| `admin_response` | text | Stanovisko vedení (schválení/zamítnutí) |
| `processed_by` | FK → users | Kdo z Vedení rozhodl |
| `processed_at` | datum | Kdy |

## Workflow krok za krokem

### 1. Žadatel odešle požadavek

- Veřejný formulář `/public/equipment-request` (nepotřebuje přihlášení).
- API: `POST /api/public/equipment-request`
- Vyplňuje: jméno, e-mail, telefon (volitelné), oddělení, pozice, typ techniky, popis, priorita.
- Validace serveru: povinná pole (jméno, e-mail, typ, popis) + formát e-mailu.
- Vytvoří se záznam se **stavem `nov_`**.
- Současně odchází **notifikace všem uživatelům s admin oprávněním pro modul Majetek** (`getUsersWithModuleAdmin("equipment")`). Notifikace směřuje na `/equipment` a má typ `equipment_request`.

### 2. IT doplní stanovisko a předá vedení

- Stránka: `Majetek → Požadavky`, rozbalit kartu požadavku, sekce *Detail a akce*.
- Zobrazí se tlačítko **„Odeslat stanovisko a odeslat vedení"** pouze tehdy, když:
  - status požadavku je `nov_`,
  - přihlášený uživatel má `equipment:write` (Editor/Admin modulu), a
  - přihlášený uživatel je v oddělení **„IT"** (hlavní nebo sekundární).
- V otevřeném formuláři IT vyplní:
  - **Stanovisko IT** (`it_response`, povinné, netriviální text) – typicky technické posouzení (lze/nelze, alternativa, cena…).
  - **Schvalovatel z Vedení** (`approval_requested_to`) – vybírá ze seznamu členů oddělení „Vedení".
- API: `PATCH /api/equipment/requests/{id}` s body `{ it_response, approval_requested_to }`.
- Server:
  - zkontroluje že status je `nov_` (jinak 400),
  - uloží stanovisko, časové razítko, IT autora (`it_response_by`),
  - zapíše přidělení (`approval_requested_to`, `approval_requested_at`),
  - přepne status na **`cek_na_schv_len_`**,
  - vytvoří **notifikaci** pro konkrétního schvalovatele (link `/equipment?tab=requests`).
- Pokud oddělení „Vedení" nemá žádné členy, UI zobrazí varování a IT akci nepovolí.

### 3a. IT / admin může rozhodnout přímo (bez předání vedení)

- Pokud IT posoudí, že o požadavku může rozhodnout samo (např. drobný servis, náhrada), může rovnou kliknout **Schválit** / **Zamítnout** přímo na kartě požadavku ve stavu *Nový*.
- K dispozici tedy má **tři** cesty: Schválit / Zamítnout / Předat vedení.
- Admin aplikace (role *admin*) má stejné možnosti jako IT.
- API: `PATCH /api/equipment/requests/{id}/approve` – endpoint akceptuje akci i ze stavu `nov_`, pokud je volající v oddělení IT nebo admin.

### 3b. Vedení schválí nebo zamítne

- Pokud IT předalo vedení (stav `cek_na_schv_len_`), uživatel vidí tlačítka **Schválit** / **Zamítnout** pouze tehdy, když:
  - `approval_requested_to` se rovná ID přihlášeného uživatele (IT konkrétně jemu přidělilo),
  - uživatel má `equipment:write` a je členem oddělení **„Vedení"**.
- Tlačítka jsou dostupná **přímo na kartě** (rychlá akce) i v rozbalené sekci *Detail a akce* – obě vedou do stejného formuláře.
- V otevřeném formuláři vyplní volitelně **Stanovisko vedení** (`admin_response`).
- API: `PATCH /api/equipment/requests/{id}/approve` s body `{ action: "approve"|"reject", admin_response? }`.
- Server:
  - akceptuje status `cek_na_schv_len_` (Vedení) nebo `nov_` (pro IT/admin – přímé rozhodnutí bez předání),
  - pro stav `cek_na_schv_len_` ověří, že `approval_requested_to === userId` (pokud volající není admin),
  - pro stav `nov_` ověří, že volající je v oddělení IT nebo je admin,
  - uloží `admin_response`, `processed_by`, `processed_at`,
  - přepne status na **`schv_leno`** nebo **`zam_tnuto`** podle akce,
  - pokud má žadatel zadaný e-mail, **odešle mu informační e-mail** o výsledku (funkce `sendEquipmentRequestResultEmail`); chyba odeslání neblokuje uložení.

### 4. IT označí jako vyřízené

- Po schválení vedení proběhne fyzické pořízení / předání techniky.
- Na kartě schváleného požadavku má **IT** k dispozici tlačítko **Vyřízeno** (rychlá akce; potvrzuje confirm dialog).
- API: `PATCH /api/equipment/requests/{id}/resolve`.
- Server:
  - kontroluje `equipment:write` a členství v „IT",
  - akceptuje pouze požadavky ve stavu `schv_leno` (jinak 400),
  - přepne status na **`vy__zeno`**,
  - pošle žadateli e-mail typu „resolved".

### 5. Po rozhodnutí

- Schválené: technika se fyzicky pořídí nebo vydá ze skladu přes standardní funkce modulu Majetek (přiřazení, protokol předání). IT následně stiskne **Vyřízeno**. **Propojení mezi konkrétním požadavkem a skutečným záznamem `equipment_items` aplikace neřeší automaticky** – pořízení/vydání se provádí samostatně, požadavek zůstává jako doklad.
- Zamítnuté: zůstanou v přehledu s možností filtrace (status filtr v horní části).
- Stav `odlo_eno` je v DB připravený, ale UI jej aktuálně nenastavuje.

## Filtry a přehled

Záložka Požadavky (`Majetek → Požadavky`) umožňuje filtrovat všechny požadavky (výchozí „Všechny"), dále jednotlivé stavy. Karty jsou řazeny podle `created_at` sestupně, maximálně 100 nejnovějších. Každá karta zobrazuje:

- číslo požadavku, stav (barevný badge), jméno žadatele, typ techniky, prioritu, stručný popis, datum vytvoření,
- pod tím autora a datum stanoviska IT, na koho byl požadavek předán,
- po rozbalení celý popis, stanovisko IT, stanovisko vedení a akční tlačítka podle role.

## Bezpečnost a oprávnění

- **Čtení seznamu:** vyžaduje `equipment:read` – každý uživatel s jakýmkoli přístupem k modulu Majetek vidí požadavky.
- **IT akce:** `equipment:write` + členství v „IT".
- **Schválení:** `equipment:write` + členství v „Vedení" + být konkrétně určeným schvalovatelem.
- **Veřejné odeslání (POST):** bez autentizace; validuje typy, e-mail a délku.

Role „Admin" (globální role uživatele) má automaticky všechna `*:admin` oprávnění včetně `equipment:write`. Přesto **musí být členem odpovídajícího oddělení**, jinak server akci nepovolí.

## Stručný přehled API

| Metoda | Endpoint | Kdo | Co dělá |
|---|---|---|---|
| `POST` | `/api/public/equipment-request` | Veřejné | Vytvoří požadavek (`nov_`), notifikuje admini Majetku |
| `GET`  | `/api/equipment/requests?status=` | `equipment:read` | Seznam požadavků s volitelným filtrem |
| `GET`  | `/api/equipment/requests/{id}` | `equipment:read` | Detail požadavku |
| `PATCH`| `/api/equipment/requests/{id}` | IT (`write` + IT odd.) | Stanovisko IT + předání Vedení |
| `PATCH`| `/api/equipment/requests/{id}/approve` | Vedení (`write` + Vedení odd.) | Schválit / zamítnout |

## Zdroje v kódu

| Soubor | Popis |
|---|---|
| `app/public/equipment-request/page.tsx` | Veřejný formulář žadatele |
| `app/api/public/equipment-request/route.ts` | POST – vytvoření požadavku + notifikace admini |
| `app/(dashboard)/equipment/EquipmentRequestsTab.tsx` | Klientská záložka „Požadavky" v modulu Majetek |
| `app/api/equipment/requests/route.ts` | GET seznam |
| `app/api/equipment/requests/[id]/route.ts` | GET detail + PATCH stanovisko IT |
| `app/api/equipment/requests/[id]/approve/route.ts` | PATCH schválení / zamítnutí + e-mail žadateli |
| `app/api/equipment/requests/[id]/resolve/route.ts` | PATCH označení jako vyřízené (IT) + e-mail žadateli |
| `lib/email.ts` – `sendEquipmentRequestResultEmail` | Informační e-mail žadateli (approved/rejected/resolved) |
| `prisma/schema.prisma` – model `equipment_requests` | Datový model a enumy |

## Známá omezení / návrhy na rozšíření

1. **Přímá vazba na `equipment_items`** chybí – po schválení se nevytváří automaticky šablona položky k pořízení.
2. **Stav „odloženo"** – UI jej zatím nenastavuje (existuje jen v DB).
3. **Eskalace** – neexistuje žádný časový trigger. Dlouho čekající požadavky lze zatím sledovat pouze manuálně přes filtr.
4. **Delegace / zástup** – schválit může pouze uživatel, kterému IT požadavek přiřadilo. Při jeho nepřítomnosti nelze schválení delegovat bez re-přidělení.
5. **Hard-coded názvy oddělení** – proces závisí na přesných textových jménech „IT" a „Vedení". Při přejmenování oddělení přestane workflow fungovat.
