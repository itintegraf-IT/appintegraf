# IT požadavky – externí dodavatelé

Modul pro evidenci síťových a servisních požadavků technologií od externích firem.

## Rozdělení rolí

| Kdo | Co vyplňuje |
|-----|-------------|
| **Dodavatel** | Identifikace (více kontaktních osob s rolí), popis technologie, zařízení a přípojky, **požadavek** na počet IP (bez adres), porty/firewall, Ano/Ne oddělená VLAN, vzdálený přístup, bezpečnost, podpis |
| **IT** | Konkrétní VLAN, přidělené IP adresy, implementace firewallu, interní poznámky, schválení |

Dodavatel **nevyplňuje** IP adresy, masky, brány, DNS ani číslo VLAN.

## Tok

1. IT založí požadavek v **IT požadavky → Externí dodavatelé**.
2. Předvyplní projekt / kontakt a uloží.
3. Odešle dodavateli odkaz (e-mail nebo zkopírování URL).
4. Dodavatel vyplní 4 sekce na `/public/it-vendor-request/[token]` (bez přístupu do aplikace).
5. IT v sekci **Přidělení sítě (IT)** doplní VLAN / IP / firewall a schválí nebo zamítne.
6. Po schválení (nebo jako náhled) otevře **Report pro dodavatele** – tisk nebo e-mail s HTML tabulkou (zařízení, IP, firewall, podpisy).

## Sekce formuláře

1. Identifikace a popis  
2. Zařízení a požadavek na IP (počet + preferovaný způsob)  
3. Porty a firewall  
4. VLAN (Ano/Ne) + přístup + bezpečnost + podpis  
5. *(jen interní)* Přidělení sítě IT  

## Stavy

`draft` → `sent` → `submitted` → `in_review` → `approved` | `rejected` | `cancelled`

## Bezpečnost odkazu

- Token: `randomBytes(32)` base64url, v DB jen SHA-256 hash.
- TTL: 30 dní; při novém odeslání se staré odkazy zneplatní.
- Veřejné API nevrací IT přidělené IP, VLAN ani interní poznámky.

## Migrace

```bash
npm run db:it-vendor-requests-migrate
```

## Klíčové cesty

- Interní: `/pozadavky?tab=externi`, `/pozadavky?tab=sit` (registr VLAN/IP), `/pozadavky/externi/[id]`, `/pozadavky/externi/[id]/report`
- Veřejné: `/public/it-vendor-request/[token]`
- API: `/api/it-vendor-requests`, `/api/it-network/vlans|subnets|ips`, `/api/it-vendor-requests/[id]/send-report`, `/api/public/it-vendor-request/[token]`

## Registr VLAN / IP

1. V **Síť / IP** založte VLAN a subnet (CIDR) – host IP se vygenerují jako **volné**.
2. V požadavku (sekce 5) vyberte VLAN a rozsah z volných IP; u firewallu přiřaďte konkrétní IP.
3. Při uložení se IP označí jako přidělené, porty z firewallu se zapíší k IP. Kolize s jiným požadavkem se zamítne (HTTP 409).
4. Smazání požadavku IP uvolní.
