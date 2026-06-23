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

## Kategorie a priorita

- **Kategorie:** `hardware`, `software`, `pristup`, `sit`, `jine`
- **Priorita:** `nizka`, `stredni`, `vysoka`

## Datový model

- `helpdesk_tickets` – hlavní tabulka (číslo ticketu `HD-ROK-#####`)
- `helpdesk_comments` – vlákno komunikace (`is_internal` pro poznámky jen pro IT)

## API

| Endpoint | Metoda | Účel |
|---|---|---|
| `/api/helpdesk/tickets` | POST | Vytvoření ticketu |
| `/api/helpdesk/tickets` | GET | IT fronta (vyžaduje správu helpdesku) |
| `/api/helpdesk/tickets/mine` | GET | Tickety aktuálního uživatele |
| `/api/helpdesk/tickets/[id]` | GET, PATCH | Detail, změna stavu, uzavření |
| `/api/helpdesk/tickets/[id]/comments` | POST | Komentář |
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
