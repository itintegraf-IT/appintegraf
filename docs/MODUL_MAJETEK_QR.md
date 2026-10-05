# Majetek – evidence drobného majetku s QR kódy

Technický plán rozšíření modulu **Majetek** (`equipment`, URL `/equipment`) o komplexní správu drobného majetku s QR identifikací, místnostmi, inventurou a rolemi.

Související dokumentace:

- [MODUL_MAJETEK_POZADAVKY.md](MODUL_MAJETEK_POZADAVKY.md) – schvalování požadavků na techniku (IT → Vedení), **již implementováno**

---

## Shrnutí v bodech

### Co už v aplikaci je

- Evidence položek majetku (`equipment_items`) – název, značka, model, S/N, cena, dodavatel, faktura, stav, poznámky
- Skupiny majetku v databázi (`equipment_categories`) – bez admin UI
- Přiřazení majetku zaměstnancům + **předávací / vrácení protokoly** (`/equipment/protokol/predani`, `vraceni`)
- Požadavky na novou techniku (veřejný formulář + workflow IT/Vedení)
- Seznam majetku s řazením a základními filtry

### Co plán přidává

- **Skupiny majetku** – plná administrace (IT technika, bílá technika, nářadí…), zodpovědný uživatel za skupinu
- **Místnosti** – samostatná evidence s QR štítky (odděleně od kalendáře rezervací)
- **QR / inventární kódy** – `asset_tag`, `qr_code`, QR jako odkaz do aplikace, tisk štítků na arch **A4 70 × 37 mm**
- **Předgenerované QR** – generace X kódů naprázdno, tisk, pozdější sken a přiřazení majetku (od 10/2026 se nepoužívá — štítek se tiskne po zařazení)
- **PWA skener** – naskenovat místnost + zařízení → umístění v databázi
- **Přesun mezi místnostmi** – sken, ručně, hromadně; protokol HTML/PDF; append-only historie
- **Role** – správce majetku, zodpovědný za skupinu, nahlížení dle skupin
- **Kompletní detail** – všechna pole včetně ceny, záruky, vyřazení, místnosti
- **Fotogalerie** – upload JPG/PNG/WebP, focení z mobilu (`capture`), náhledová fotka
- **Přílohy** – PDF faktury, záruční listy
- **Inventura** – inventurní akce se skenováním, stavy nalezeno/chybí/neočekávané
- **Reporty** – přehledy, souhrn hodnot, historie přesunů, export CSV/PDF/Excel
- **Dashboard** – KPI, upozornění (končící záruka, chybějící místnost/fotka)
- **Vyřazení** – formální workflow s protokolem
- **Import/export Excel** – hromadné zavedení evidence

### Co je mimo scope (Fáze 5 / budoucí)

- Účetní amortizace a odpisy
- Externí výpůjčky mimo organizaci
- Offline inventura bez připojení k síti
- Nativní Android aplikace (API připravíme, PWA pokryje první fázi)

### Odhad implementace

| Fáze | Rozsah | Odhad |
|------|--------|-------|
| 1 | Model, role, admin, detail, fotky, štítky, fond QR | 5–7 dní |
| 2 | PWA skener, přesuny, protokoly, vyřazení | 3–4 dny |
| 3 | Inventura, reporty, dashboard, Excel | 3–4 dny |
| 4 | Nativní Android | samostatný projekt |
| 5 | Volitelná rozšíření | dle potřeby |

**Celkem MVP (Fáze 1–3):** přibližně 11–14 pracovních dní.

---

## Architektura

Modul rozšiřujeme pod existujícím klíčem `equipment` (URL `/equipment`, oprávnění v `module_access`). Nezakládáme paralelní `/majetek`.

```mermaid
flowchart TB
  subgraph existujici [Již existuje]
    Items[equipment_items]
    Cats[equipment_categories]
    Assign[equipment_assignments]
    Requests[equipment_requests]
    ProtoUser[Protokoly předání/vrácení]
  end

  subgraph nove [Nově]
    Rooms[equipment_rooms]
    Hist[equipment_location_history]
    Inv[equipment_inventories]
    Access[equipment_user_category_access]
    Files[file_uploads module=equipment]
  end

  subgraph ui [Uživatelské rozhraní]
    Web[Web admin]
    PWA[PWA skener]
  end

  Web --> Items
  Web --> Rooms
  PWA --> Items
  PWA --> Rooms
  Items --> Hist
  Items --> Files
  Cats --> Access
```

---

## Role a oprávnění

| Role | Přidělení | Oprávnění |
|------|-----------|-----------|
| **Správce majetku** | `equipment:admin` v Admin → Uživatelé (nebo globální admin) | Vše jako Editor + nastavení (skupiny, místnosti, číselná řada, štítky, notifikace), import z Excelu, smazání omylem založené položky bez historie, změna zodpovědné osoby skupiny, celofiremní inventura |
| **Editor modulu = správa evidence** | `equipment:write` | Celá evidence: zařazování nákupů (číslo z řady), úpravy, přiřazení, přesuny, inventura místnosti a skupiny. Úroveň pro **účtárnu** |
| **Čtenář modulu** | `equipment:read` | Čtení všeho, nebo jen přidělených skupin (pokud má záznamy v `equipment_user_category_access`) |
| **Zodpovědný za skupinu** | `responsible_user_id` na `equipment_categories` (mění jen správce) | Položky své skupiny: úpravy, přiřazení, skenování, přesuny, inventura skupiny. Nákupy nezařazuje |
| **Nahlížení** | `equipment_user_category_access` | Jen čtení přidělených skupin |

Centrální logika: `lib/equipment/access.ts` – `canReadEquipment` / `canWriteEquipment` (s kontextem `categoryId`), `canManageRegister` (správa evidence), `canAdministerEquipment` (správce).

Úroveň **Admin** u Majetku dostává i notifikace o nových požadavcích a tiketech helpdesku (`getUsersWithModuleAdmin("equipment")`) — účetním proto dávat **Editor**.

---

## Datový model

### Nové tabulky

**`equipment_rooms`**

| Pole | Popis |
|------|-------|
| `name`, `code` | Název a kód místnosti (např. A-205) |
| `building`, `floor`, `description` | Upřesnění polohy |
| `qr_code` | Unikátní kód pro štítek (`RM-…`) |
| `is_active` | Aktivní / archivovaná |

**`equipment_location_history`** (append-only audit přesunů)

| Pole | Popis |
|------|-------|
| `equipment_id`, `from_room_id`, `to_room_id` | Přesun |
| `transferred_by`, `transferred_at` | Kdo a kdy |
| `source` | `scan` / `manual` / `bulk` |
| `notes`, `protocol_number` | Poznámka, číslo protokolu (`PM-{rok}-{id}`) |

**`equipment_user_category_access`**

| Pole | Popis |
|------|-------|
| `user_id`, `category_id` | Přístup uživatele ke skupině |
| `access_level` | `read` (nahlížení) |
| `granted_by`, `granted_at` | Audit přidělení |

**`equipment_inventories`** + **`equipment_inventory_lines`**

- Inventurní akce: název, rozsah (vše / místnost / skupina), stav (koncept / probíhá / dokončeno)
- Řádky: položka, očekávaná místnost, čas skenu, stav (`found` / `missing` / `unexpected` / `extra`)

**`equipment_qr_pool`** — fond předgenerovaných kódů

| Pole | Popis |
|------|-------|
| `qr_code`, `asset_tag` | Unikátní kód a inventární číslo |
| `status` | `available` / `assigned` / `void` |
| `batch_id` | Dávka generování |
| `equipment_id` | Položka po přiřazení (null = volný) |

### Rozšíření `equipment_items`

| Pole | Popis |
|------|-------|
| `asset_tag` | Inventární číslo (z účetní evidence nebo z číselné řady 100xxx) |
| `qr_code` | Kód v QR štítku (12 číslic; obsah QR viz kap. 3) |
| `label_printed_at` | Kdy byl štítek potvrzen jako vytištěný (null = bez štítku) |
| `room_id` | FK na místnost |
| `cover_file_id` | Náhledová fotka |
| `warranty_until` | Konec záruky |
| `last_service_at` | Poslední servis |

Pole `location` (volný text) zůstává jako legacy z importu („Název (kód)“); místnost je `room_id`. Text čte jen Příprava dat (kap. 3b).

### Soubory (`file_uploads`)

| `document_type` | Účel |
|-----------------|------|
| `photo` | Fotografie majetku |
| `photo_cover` | Náhledová fotka |
| `invoice` | Faktura (FA) |
| `delivery_note` | Dodací list |
| `warranty` | Záruční list |
| `service` | Servisní protokol |
| `attachment` | Obecná příloha |
| `other` | Jiný dokument |

UI: sekce **Dokumenty** na detailu položky (`EquipmentDocumentsPanel`). API: `GET/POST/DELETE /api/equipment/[id]/photos?kind=attachment`.

Úložiště: `uploads/equipment/{equipmentId}/`

### Rozšíření `equipment_categories`

- `responsible_user_id` – zodpovědný uživatel za skupinu
- `label_required` – skupina se polepuje štítky (vypnuto u majetku inventarizovaného podle dokladů: auta, budovy, software)

Místnosti (`equipment_rooms`) mají také `label_printed_at`.

---

## Funkce podle oblastí

### 1. Administrace

| Funkce | URL / API | Kdo |
|--------|-----------|-----|
| Skupiny majetku | `/equipment/settings/categories` | Správce |
| Přístupy nahlížení | `/equipment/settings/access` | Správce |
| Místnosti | `/equipment/rooms` | Správce |
| Tisk štítku místnosti (1×) | `GET …/rooms/[id]/label?start=N` | Čtení majetku |
| Hromadný tisk místností (A4) | `POST …/rooms/labels` `{ ids, startPosition }` | Čtení (tlačítko jen správa evidence) |
| Potvrzení vytištění | `POST …/labels/confirm` `{ kind, ids, printed }` | Zápis do skupiny / správa evidence u místností |
| Mřížka A4, text vlastníka | `/equipment/settings/labels` · `GET/PUT …/settings/label-grid` | Správce |
| Příprava dat | `/equipment/settings/data-prep` · `GET/POST …/data-prep/[rooms\|holders]` | Správce |

Výchozí seed skupin: *Výpočetní a komunikační technika*, *Bílá technika*, *Nářadí*.

### 2. Evidence položek

**Pole v detailu a editaci:**

- Identifikace: název, skupina, asset tag, QR, S/N
- Technické: značka, model, popis
- Nákup: datum, cena, dodavatel, číslo faktury
- Stav: skladem / přiřazeno / servis / vyřazeno
- Vyřazení: datum, důvod
- Umístění: místnost (dropdown), historie přesunů
- Záruka a servis: `warranty_until`, `last_service_at`
- Poznámky, datum zápisu, stáří
- Přiřazený uživatel, zodpovědný za skupinu

Sdílená komponenta: `EquipmentItemForm`.

**Zařazení nákupu** (`/equipment/add`, jen správa evidence; od 1. 10. 2026 je aplikace hlavní evidencí drobného majetku):

- Povinné: doklad (číslo faktury), datum pořízení, pořizovací cena za kus **bez DPH** (při neuplatněném odpočtu s DPH), název, skupina. Validace `lib/equipment/new-item-validation.ts` je společná pro formulář i server.
- Inventární číslo přidělí aplikace z **číselné řady drobného majetku 100xxx** (`lib/equipment/asset-number.ts`). Start řady nastaví správce v Nastavení → Inventární čísla zadáním posledního čísla z ABRA Gen; čísla se přidělují postupně pod zámkem a nikdy se nepoužijí znovu.
- Majetek s cenou **vyšší než 80 000 Kč** je odepisovaný a eviduje se v ABRA Gen → zadává se ručně jeho číslo z Gen, po jednom kuse. Číslo z řady jen s výslovným potvrzením, že jde o drobný majetek.
- Ručně zadané číslo ve tvaru řady od startu výš aplikace odmítne (patří řadě).
- Více kusů najednou: každý kus má vlastní číslo; po uložení souhrn přidělených čísel.

**Smazání:** jen omylem založená položka bez historie (přiřazení, přesuny, inventury, soubory, kódy z fondu) a jen správce; jinak se položka vyřadí. Kontrola `lib/equipment/item-history.ts`.

### 3. QR kódy a štítky

**QR je odkaz:** `<adresa aplikace>/q/<qr_code>` — fotoaparát telefonu otevře kartu položky nebo místnosti (po přihlášení). Adresa z `EQUIPMENT_QR_BASE_URL`, jinak `AUTH_URL` (localhost se nepoužije). **Bez platné adresy se štítky netisknou** — tisk skončí hláškou pro správce; na obrazovce zůstává starý text `INTEGRAF:EQ:{qr_code}` / `INTEGRAF:RM:{qr_code}`. Každý server proto musí mít v `.env` `EQUIPMENT_QR_BASE_URL` (produkce `https://…`, test adresa testu). Skener čte oba formáty. Stránka `/q/[kód]` položku bez oprávnění neprozradí; u kódu shodného s položkou i místností nabídne volbu. Implementace: `lib/equipment/qr-url.ts`, `qr-landing.ts`.

**Formát štítku:** jeden materiál pro majetek i místnosti — **arch A4 70 × 37 mm, 3 × 8** (výchozí šablona `a4_70x37_3x8`; další šablony a vlastní rozměry v `/equipment/settings/labels`, uloženo v `system_settings` klíč `equipment_label_grid`, mřížka se musí vejít na A4).

| Typ | Obsah na štítku |
|-----|-----------------|
| Majetek | vlastník („Majetek Integraf, s.r.o.“, nastavitelný), inventární číslo (tučně, nikdy se nezkracuje — dlouhé se zalomí na dva řádky), název (max. 2 řádky), skupina, u počítané položky „× N ks“, QR |
| Místnost | vlastník, kód, název, budova/patro, QR |

- Obsah drží odstup ≥ 4 mm od okraje papíru (laserová tiskárna kraj nepotiskne). Tisknout ve **skutečné velikosti (100 %)**.
- Mimo produkci (`APP_ENV=test` na testu, lokální `next dev`) štítek nese výrazné **TEST — neplatný štítek**.
- **Tisk:** dialog Tisk štítků (seznam, řádek, detail, souhrn zařazení, místnosti) — počet, **pozice na načatém archu**, stažení PDF. PDF je seřazené po místnostech. Generování nic nezapisuje.
- **Evidence tisku:** po stažení se dialog zeptá „Vytiskly se štítky správně?“ — teprve potvrzení zapíše `label_printed_at`; na detailu jde označit jako nevytištěný. Filtr **Bez štítku** v seznamu (s QR, bez potvrzeného tisku, nevyřazené, jen skupiny se štítky) a „Jen bez štítku“ u místností.
- API obrázku QR: `GET /api/equipment/qr?code=…`

Implementace: `lib/equipment/label-layout.ts`, `label-text.ts`, `label-plan.ts`, `label-filters.ts`, `label-grid-settings.ts`, `label-pdf.ts`, `_components/LabelPrintDialog.tsx`.

**Fond předgenerovaných QR se od 10/2026 nepoužívá** — štítek se tiskne až po zařazení (číslo vždy z řady, žádné párování kódů). Nastavení fondu a režim *Přiřadit QR* ve skeneru jsou schované; tabulka `equipment_qr_pool` a API zůstávají. Naskenovaný volný kód z fondu skener nahlásí.

### 3b. Příprava dat (úklid původní evidence)

Stránka `/equipment/settings/data-prep` (jen správce), jednorázově před lepením štítků a inventurou:

| Krok | Co dělá |
|------|---------|
| Místnosti podle textu umístění | Z `location` („Název (kód)“) navrhne místnost: automaticky jen kde sedí kód i název (nebo dřívější název sloučené místnosti z popisu „Také: …“); neznámý kód s jednoznačným názvem a kód s jiným názvem jsou návrhy k potvrzení; středisko, prázdné a neznámé zůstanou ve skupinách k obchůzce. Kód vždy rozhoduje před názvem. |
| Držitelé z poznámek | Z „Pracovník: …“ přiřadí držitele: shoda celého jména předvybraná, shoda jen podle příjmení k potvrzení, pracoviště a nejednoznačná jména nikdy. Položku, která už v aplikaci držitele měla (i vráceného), přeskočí — poznámka z importu je starší. Upozorní na možnou duplicitu (držitel už má podobnou položku). |

- Náhled ukáže přesně, co se změní; provedou se jen vybrané řádky, které jsou v plánu i v okamžiku zápisu (opakování nic nezdvojí). Vše v jedné transakci se souhrnným auditem, bez notifikací.
- Zařazení do místnosti zapíše historii **„Z původní evidence“** (`source: import`) bez protokolu přesunu; původní text umístění i poznámky zůstávají.
- Během probíhající inventury se úklid neprovede.
- Virtuální místa: Praha a manipulační technika dostanou vlastní místnosti (kódy 30004, 30003, 30002 podle původní evidence) — po jejich založení je krok Místnosti zařadí automaticky. Auta, budovy a software jsou ve skupinách se štítky vypnutými.

Implementace: `lib/equipment/data-prep/location-match.ts`, `holder-match.ts`, `apply.ts`, `app/api/equipment/data-prep/[step]/route.ts`.

### 4. PWA skener (Android / mobil)

Stránka `/equipment/scan`:

1. Naskenuj QR místnosti
2. Naskenuj QR zařízení (opakovaně)
3. Potvrzení → `POST /api/equipment/placement`
4. Volitelně tisk protokolu přesunu

Závislost: `html5-qrcode`. Fallback: ruční zadání kódu.

**Rozpoznání kódu** (jedno pro celý modul: `lib/equipment/scan-code.ts` = čistá logika, `scan-resolve.ts` = dotazy, `GET /api/equipment/lookup?code=…&target=any|item|room`):

- Odkaz `…/q/<kód>` z QR štítku se převede na kód. QR s prefixem `INTEGRAF:EQ:` (nebo 12místný kód) je vždy položka, `INTEGRAF:RM:` / `RM-…` vždy místnost.
- Holý kód (ruční zadání, inventární číslo, sériové číslo, kód místnosti): u položky má přednost inventární číslo, pak QR, pak sériové číslo. Když kód odpovídá položce i místnosti (např. `1012`), skener nabídne výběr — nikdy tiché přepnutí.
- **Přesun a inventura přijímají jen položky** (`target=item`); kód místnosti tam vrátí srozumitelnou chybu. Kód místnosti se zadává jen na skeneru.

**Chování skeneru v terénu:**

- Kód, který zůstává v záběru kamery, se zpracuje jednou; znovu až po oddálení kamery (`lib/equipment/scan-gate.ts`).
- Položka už v cílové místnosti → jen informace, bez dialogu. Umístění vždy po potvrzení v dialogu; notifikace držiteli a účtárně se volí zaškrtnutím přímo v dialogu (volba platí pro relaci).
- Stav (chyba, informace, potvrzení s odkazem na protokol) je nad kamerou, náhled kamery je čtvercový.
- Požadavky terénních obrazovek (sken, přesun, inventura) mají časový limit 12 s (`lib/equipment/field-fetch.ts`); při výpadku sítě obrazovka řekne, zda se změna mohla uložit.
- Kamera se vypne i při odchodu ze stránky během dotazu na povolení.

### 5. Přesun mezi místnostmi

Jednotná funkce `transferEquipmentToRoom()` v `lib/equipment/room-transfer.ts`:

| Způsob | `source` |
|--------|----------|
| Sken PWA | `scan` |
| Formulář / modal | `manual` |
| Výběr více položek | `bulk` |

**Protokol přesunu:**

- HTML: `/equipment/protokol/presun-mistnosti?historyId=`
- PDF: `GET /api/equipment/transfers/[historyId]/pdf`

**Audit:** `equipment_location_history` + `audit_log` (`action: room_transfer`).

**Notifikace o pohybu** (přesun, přiřazení, vrácení — jen se souhlasem uživatele): držitel, členové oddělení **Účetnictví** (kód `ACC`) a další příjemci z Nastavení → Notifikace (`lib/equipment-movement-notify.ts`). Hromadný přesun nebo přiřazení pošle **jednu souhrnnou** notifikaci na příjemce (držitel jednu za své kusy), ne jednu za každou položku.

### 6. Fotogalerie a přílohy

**Fotky:**

- Upload více souborů (JPG, PNG, WebP, GIF)
- Focení z mobilu: `<input capture="environment">`
- Náhledová fotka ve seznamu majetku
- API: `/api/equipment/[id]/photos`

**Přílohy:**

- PDF faktury, záruční listy, servisní protokoly
- API: `/api/equipment/[id]/attachments`

### 7. Přiřazení zaměstnanci (existující)

- Přiřazení / vrácení majetku uživateli
- Protokoly předání a vrácení
- Nezávislé na umístění v místnosti

### 8. Inventura a inventurní sestavy

**Tři rozsahy** (platí pro živou inventuru i statické sestavy):

| Rozsah | Popis |
|--------|-------|
| **Kompletní** | Celý majetek (dle oprávnění uživatele) |
| **Skupina** | Jedna skupina majetku (IT technika, nářadí…) |
| **Místnost** | Vše v dané místnosti |

**Živá inventura** (`/equipment/inventura`):

- Založení akce s výběrem rozsahu — **kdo smí:** místnost správa evidence (Editor/správce; seznam místnosti obsahuje všechny kusy), skupina kdokoli se zápisem do skupiny (i zodpovědný), celá firma jen správce. Rozsah se vždy vybírá výslovně (žádná „omylem celofiremní“ inventura).
- Pro stejný rozsah běží nejvýš jedna inventura; druhé založení otevře probíhající.
- Skenování položek (kód místnosti v inventuře je chyba). Stavy řádku (`lib/equipment/inventory-rules.ts`, `inventory-status.ts`): *Čeká na sken* → *Nalezeno* / *Nalezeno, evidováno jinde*; položka mimo seznam *Navíc (není v seznamu)* — opakovaný sken ji nezmění; po uzavření nenaskenované *Chybí*.
- Souhrn „Nalezeno X z Y“ počítá jen položky ze seznamu, položky navíc zvlášť.
- Uzavírá zakladatel nebo správce, po potvrzení v dialogu se souhrnem; uzavření nelze vrátit. Sken i uzavření míří vždy na zobrazenou inventuru.
- Po uzavření → inventurní protokol (soupis podle § 30 ZoÚ: vlna 3)

**Statická inventurní sestava** (`/equipment/reporty`):

- Okamžitý výpis bez skenování — „stav k dnešku“
- Stejné rozsahy: kompletní / skupina / místnost
- Sloupce: asset tag, název, skupina, místnost, stav, hodnota, přiřazeno komu
- Souhrn: počet položek, `SUM(purchase_price)`
- Export PDF / CSV / Excel

### 9. Reporty a dashboard

**Dashboard** (`/equipment` nebo `/equipment/dashboard`):

- Počty dle skupiny a stavu
- Souhrnná hodnota majetku
- Upozornění: končící záruka, chybějící místnost/fotka
- Poslední přesuny

**Reporty** (`/equipment/reporty`):

- Přehled majetku s filtry
- Souhrn hodnot po skupinách a místnostech
- Historie přesunů
- Export CSV / PDF / Excel

**Vyhledávání:** fulltext v názvu, asset tag, S/N, značce, modelu, poznámkách.

### 10. Vyřazení majetku

- Akce *Vyřadit* na detailu (důvod povinný)
- Protokol o vyřazení HTML/PDF
- Vyřazenou položku nelze přesouvat ani přiřazovat

### 11. Import / export Excel

- Export všech sloupců dle oprávnění
- Import s preview a validací (match dle `asset_tag` nebo S/N)
- Šablona XLSX ke stažení

---

## Implementační fáze

### Fáze 1 – Základy (5–7 dní)

- Prisma migrace (všechny nové tabulky a sloupce včetně `equipment_qr_pool`)
- `lib/equipment/access.ts`
- Admin: skupiny, místnosti, přístupy nahlížení
- QR generování + PDF štítky (vizitka)
- **Fond předgenerovaných QR** — generace X, tisk dávky, přiřazení skenem
- Kompletní detail/editace + fotogalerie
- Přílohy (dokumenty)

### Fáze 2 – Mobil a přesuny (3–4 dny)

- PWA skener `/equipment/scan`
- Lookup API
- Přesun (sken + ruční + hromadný)
- Protokoly přesunu HTML/PDF
- Vyřazení s protokolem
- Úprava seznamu (místnost, miniatura, filtry)

### Fáze 3 – Inventura a reporty (3–4 dny)

- Inventurní akce a řádky
- Dashboard a upozornění
- Reporty a exporty
- Import/export Excel
- Stránkování a fulltext

### Fáze 4 – Nativní Android (budoucí)

- Stabilní REST API pro mobilní klienta
- Sdílený formát QR
- Volitelně token auth mimo session cookies

---

## Kontrolní seznam pokrytí (drobný majetek)

| Požadavek | Stav |
|-----------|------|
| Inventární číslo / QR | Plánováno |
| Předgenerované QR (tisk → sken → přiřazení) | Plánováno |
| Skupiny definované administrátorem | Plánováno |
| Místnosti s QR štítky | Plánováno |
| Skenování mobilem | Plánováno (PWA) |
| Umístění a přesun mezi místnostmi | Plánováno |
| Protokoly přesunu | Plánováno |
| Auditní stopa | Plánováno |
| Role správce / zodpovědný / nahlížení | Plánováno |
| Kompletní karta majetku | Plánováno |
| Fotodokumentace | Hotovo |
| Přílohy (faktury, dodací listy) | Hotovo |
| Pořizovací hodnota a reporty | Plánováno |
| Inventura | Plánováno |
| Vyřazení s protokolem | Plánováno |
| Záruka / servis | Plánováno |
| Přiřazení zaměstnanci + protokoly | **Existuje** |
| Požadavky na techniku | **Existuje** |
| Hromadný import | Plánováno |
| Amortizace | Mimo scope |
| Offline režim | Fáze 5 |

---

## Klíčové soubory

| Oblast | Cesty |
|--------|-------|
| Schéma | `prisma/schema.prisma` |
| Přístupová práva | `lib/equipment/access.ts` |
| Přesuny | `lib/equipment/room-transfer.ts` |
| QR / štítky | `lib/equipment/qr.ts`, `label-layout.ts`, `label-grid-settings.ts`, `label-pdf.ts` |
| Fond QR (nepoužívá se) | `lib/equipment/qr-pool.ts`, `app/api/equipment/qr-pool/**` |
| Příprava dat | `lib/equipment/data-prep/**`, `app/api/equipment/data-prep/**`, `equipment/settings/data-prep/**` |
| Upload | `lib/equipment/upload.ts` |
| API | `app/api/equipment/**` |
| UI | `app/(dashboard)/equipment/**` |
| Navigace | `components/layout/Sidebar.tsx` |
| Záloha | `lib/backup/module-registry.ts` (+ `file_uploads`, `uploads/equipment/`) |
| Existující protokoly | `app/(dashboard)/equipment/protokol/` |

---

## Rizika

| Riziko | Mitigace |
|--------|----------|
| Legacy pole `location` (volný text) | Sync z místnosti; postupná konverze |
| Duplicitní QR kódy | Unikátní indexy, generace na serveru |
| Kamera na Androidu vyžaduje HTTPS | Test na Chrome Android; fallback ruční kód |
| Velké množství položek | Stránkování, fulltext, indexy |
| Úložiště fotek | Záloha včetně `uploads/equipment/` |
| Křížení rolí (zodpovědný + nahlížení) | Sjednocení v `access.ts` |
| Zpětná kompatibilita oprávnění | `equipment:read` bez omezení skupin = plný přístup |

---

## Navigace v modulu

V levém sidebaru je jen položka **Majetek** → `/equipment` (bez rozbalovací podnabídky).

Uvnitř modulu je horní lišta záložek (`EquipmentModuleNav`): Přehled, Přiřazení, Místnosti, **Půdorys**, Skenovat, Přesun, Inventura, Reporty, a pro správce **Nastavení** (`/equipment/settings` – hub se skupinami, přístupy, číselnou řadou, štítky a přípravou dat).

Na přehledu jsou navíc rychlé dlaždice na hlavní workflow.

### Interaktivní půdorys (`/equipment/plan`)

- Upload PDF/PNG/JPG jako pozadí (1NP, 2NP…) → `equipment_floor_plans`
- Editor polygonů místností (body 0–1 relativně k obrázku) napojený na `equipment_rooms`
- Prohlížení: klik na místnost → seznam majetku; přetažení položky na jinou místnost = přesun (`transferEquipmentToRoom`)
- Zoom / pan (kolečko, režim ruky, mezerník)
