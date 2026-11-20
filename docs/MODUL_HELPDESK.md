# Helpdesk – IT servis (ticketový systém)

Dokumentace modulu helpdesku pro požadavky na IT servis (poruchy, software, přístupy, síť).

## Účel

Přihlášení zaměstnanci mohou založit ticket na IT oddělení, sledovat stav a komunikovat přes komentáře. IT správci ticket přiřadí, řeší a uzavřou.

Helpdesk je dostupný na `/pozadavky` → záložka **Helpdesk**. Veřejný formulář pro helpdesk není – vyžaduje přihlášení.

## Aktéři

| Role | Přístup | Co dělá |
|---|---|---|
| **Žadatel** | `/pozadavky?tab=helpdesk` | Vytvoří ticket, vidí vlastní tickety, komentuje, uzavře vyřešený |
| **IT** | Stejná stránka + sekce IT fronta | Člen oddělení „IT" + `equipment:write` (nebo admin) – přiřazení, změna stavu, interní poznámky |

## Stavy ticketu

| Kód | Význam |
|---|---|
| `novy` | Právě vytvořen |
| `prirazeno` | Přiřazen řešiteli |
| `resi_se` | Probíhá řešení |
| `vyreseno` | IT vyřešilo (s popisem řešení) |
| `uzavreno` | Uzavřeno žadatelem nebo IT |

## Archiv

Uzavřené tickety zůstávají v databázi (`status=uzavreno`, `closed_at`). V UI na `/pozadavky?tab=helpdesk` je u **IT fronty** i **Moje tickety** přepínač **Otevřené / Archiv / Vše**.

- **Otevřené** – vše kromě `uzavreno` (výchozí)
- **Archiv** – jen uzavřené
- **Vše** – bez filtru stavu

Deep-link na uzavřený ticket (`?tab=helpdesk&id=…`) automaticky přepne filtr na Archiv, aby ticket zůstal ve seznamu.

IT fronta API: `GET /api/helpdesk/tickets?status=open|uzavreno|all` (default `open`).

## Kategorie a priorita

- **Kategorie:** `hardware`, `software`, `pristup`, `sit`, `jine`
- **Priorita:** `nizka`, `stredni`, `vysoka`

## Datový model

- `helpdesk_tickets` – hlavní tabulka (číslo ticketu `HD-ROK-#####`)
- `helpdesk_comments` – vlákno komunikace (`is_internal` pro poznámky jen pro IT)
- `file_uploads` – přílohy ticketu (`module=helpdesk`, `record_id=ticket.id`) a komentáře (`module=helpdesk_comment`, `record_id=comment.id`); soubory na disku v `public/uploads/helpdesk/`

## Přílohy

- **Ticket** – při založení (fronta před odesláním) i později v detailu
- **Komentář** – fronta před odesláním komentáře
- Typy: PDF, obrázky, log/txt/csv, ZIP, Word, Excel · max. 20 MB · max. 20 souborů na ticket/komentář
- Uzavřený ticket (`uzavreno`): přílohy jen ke čtení
- Přílohy interních komentářů vidí pouze IT
- Otevření/stažení vždy přes API (`GET .../files/[fileId]`), nikoli přímou cestou do `public/uploads/` — Next.js v produkci neobslouží soubory přidané po startu procesu

## API

| Endpoint | Metoda | Účel |
|---|---|---|
| `/api/helpdesk/tickets` | POST | Vytvoření ticketu |
| `/api/helpdesk/tickets` | GET | IT fronta / archiv (`?status=` `open` / `uzavreno` / `all`, default `open`; vyžaduje správu helpdesku) |
| `/api/helpdesk/tickets/mine` | GET | Tickety aktuálního uživatele |
| `/api/helpdesk/tickets/[id]` | GET, PATCH | Detail, změna stavu, uzavření |
| `/api/helpdesk/tickets/[id]/comments` | POST | Komentář |
| `/api/helpdesk/tickets/[id]/files` | GET, POST | Přílohy ticketu |
| `/api/helpdesk/tickets/[id]/files/[fileId]` | GET, DELETE | Stažení / smazání přílohy ticketu |
| `/api/helpdesk/tickets/[id]/comments/[commentId]/files` | GET, POST | Přílohy komentáře |
| `/api/helpdesk/tickets/[id]/comments/[commentId]/files/[fileId]` | GET, DELETE | Stažení / smazání přílohy komentáře |
| `/api/helpdesk/context` | GET | Kontext UI (`canManageHelpdesk`, členové IT) |

## Notifikace

- Nový ticket → admini modulu Majetek (`equipment`)
- Změna stavu / komentář IT → žadatel
- Komentář žadatele → přiřazený řešitel (pokud existuje)

## Vztah k požadavkům na techniku

| | Technika | Helpdesk |
|---|---|---|
| Účel | Nákup / dodání vybavení | IT servis, poruchy |
| Schvalování vedením | Ano (IT → Vedení) | Ne |
| Veřejný formulář | Ano (`/public/equipment-request`) | Ne |
| Správa workflow | Majetek → Požadavky | `/pozadavky?tab=helpdesk` (IT fronta) |
