# IML – XML export objednávek (pro vývojáře jiných systémů)

Technický popis formátu **šablonového XML exportu přijatých objednávek** z modulu IML (APPIntegraf).

Tento dokument popisuje výstup z **Import / Export → Objednávky** (formát XML) a z API `POST /api/iml/orders/export/run`.

---

## 1. Účel

Export slouží k přenosu **přijatých objednávek** (hlavička + řádky položek + data produktů z katalogu) do externích systémů (ERP, plánování, výroba, WMS).

| Vlastnost | Hodnota |
|-----------|---------|
| Kódování | UTF-8 |
| Deklarace | `<?xml version="1.0" encoding="UTF-8"?>` |
| Kořenový prvek | `<Orders>` |
| Granularita | 1× `<Order>` = 1 objednávka; 1× `<Item>` = 1 řádek položky |
| Namespace | **není** (žádný `xmlns`) |
| Pořadí prvků | podle sloupců zvolených v šabloně exportu |

> **Poznámka:** Sada prvků uvnitř `<Order>` / `<Item>` **není pevná** – závisí na šabloně (které sloupce uživatel zaškrtl). Integrátor by měl parsovat podle **názvů elementů** (klíčů), ne podle pevné pozice.

---

## 2. Odlišné XML formáty v IML (neplést)

| Formát | Endpoint / místo | Kořen | Účel |
|--------|------------------|-------|------|
| **Šablonový export objednávek** (tento manuál) | `POST /api/iml/orders/export/run` | `<Orders>` | Obecný přenos do cizích systémů |
| Cicero / Pey (jedna objednávka) | `GET /api/iml/orders/{id}/export-xml` | `<Order>` + `<Header>` | Starší integrační XML |
| Export produktů | `POST /api/iml/products/export/run` | `<Products>` | Katalog produktů, ne objednávky |

---

## 3. Struktura dokumentu

```
Orders
 └── Order                 (0..N)
      ├── {order_*}        hlavičková pole (volitelná sada)
      └── Items            (pokud je vybraný alespoň 1 sloupec řádku/produktu)
           └── Item        (0..N – jeden za každou položku objednávky)
                └── {line_* / product_*}
```

### 3.1 Příklad (výchozí šablona)

```xml
<?xml version="1.0" encoding="UTF-8"?>
<Orders>
  <Order>
    <order_number>OBJ-2026-0142</order_number>
    <job_number>2608142</job_number>
    <customer_name>MART-PLASTIC s.r.o.</customer_name>
    <order_date>2026-08-11</order_date>
    <expected_ship_date>2026-08-25</expected_ship_date>
    <status>potvrzená</status>
    <Items>
      <Item>
        <quantity>5000</quantity>
        <unit_price>1.25</unit_price>
        <subtotal>6250.00</subtotal>
        <ig_code>03-01-264</ig_code>
        <ig_short_name>Etiketa kelímek</ig_short_name>
        <client_code>MP-264</client_code>
        <client_name>Etiketa kelímek 68x135</client_name>
        <pantone_codes>Pantone 186 C, Pantone Black C</pantone_codes>
      </Item>
      <Item>
        <quantity>2000</quantity>
        <unit_price>0.90</unit_price>
        <subtotal>1800.00</subtotal>
        <ig_code>03-01-265</ig_code>
        <ig_short_name>Etiketa víčko</ig_short_name>
        <client_code>MP-265</client_code>
        <client_name>Etiketa víčko</client_name>
        <pantone_codes>Pantone 186 C</pantone_codes>
      </Item>
    </Items>
  </Order>
</Orders>
```

### 3.2 Pravidla

1. TextEncoding:** UTF-8; speciální znaky v textu jsou escapované (`&amp;`, `&lt;`, `&gt;`, `&quot;`, `&apos;`).
2. **Prázdné hodnoty:** element je přítomný, obsah může být prázdný (`<job_number></job_number>`).
3. **Objednávka bez položek:** `<Order>` obsahuje hlavičku; `<Items>` může chybět, pokud v šabloně nejsou žádné line/product sloupce. Pokud line/product sloupce jsou a objednávka nemá položky, export může obsahovat syntetický řádek s `line_id=0` a prázdnými produktovými poli.
4. **Opakování hlavičky:** v XML se hlavička **neopakuje** u každé položky – je jednou pod `<Order>`, položky jsou vnořené.
5. **Žádné atributy** na elementech – vše je textový obsah child elementů.

---

## 4. Katalog prvků

Názvy elementů = technické klíče (snake_case). Skupina určuje, zda se prvek vypisuje pod `<Order>` nebo pod `<Item>`.

### 4.1 Hlavička objednávky (`<Order>`)

| Element | Typ | Popis | Příklad |
|---------|-----|-------|---------|
| `order_id` | integer (string) | Interní ID objednávky v APPIntegraf | `142` |
| `order_number` | string | Evidenční číslo objednávky (unikátní) | `OBJ-2026-0142` |
| `job_number` | string | Číslo zakázky pro párování s jiným systémem | `2608142` |
| `customer_name` | string | Název zákazníka (IML katalog) | `MART-PLASTIC s.r.o.` |
| `order_date` | date `YYYY-MM-DD` | Datum přijetí | `2026-08-11` |
| `expected_ship_date` | date `YYYY-MM-DD` | Plánovaná expedice (může být prázdné) | `2026-08-25` |
| `status` | enum string | Stav objednávky (viz §5) | `potvrzená` |
| `total` | decimal string | Celková částka objednávky (Kč) | `8050.00` |
| `notes` | string | Poznámky | `Urgentní` |
| `shipping_label` | string | Snapshot doručení – označení adresy | `Sklad Brno` |
| `shipping_recipient` | string | Snapshot – příjemce | `Recepce` |
| `shipping_street` | string | Snapshot – ulice | `Průmyslová 12` |
| `shipping_city` | string | Snapshot – město | `Brno` |
| `shipping_postal_code` | string | Snapshot – PSČ | `60200` |
| `shipping_country` | string | Snapshot – země | `Česká republika` |
| `order_created_at` | date `YYYY-MM-DD` | Datum vytvoření záznamu | `2026-08-11` |

### 4.2 Řádek položky (`<Item>` – skupina line)

| Element | Typ | Popis | Příklad |
|---------|-----|-------|---------|
| `line_id` | integer (string) | Interní ID řádku | `901` |
| `quantity` | integer (string) | Objednané množství (ks) | `5000` |
| `unit_price` | decimal string | Jednotková cena | `1.25` |
| `subtotal` | decimal string | Mezisoučet řádku | `6250.00` |

### 4.3 Produkt z katalogu (`<Item>` – skupina product)

| Element | Typ | Popis | Příklad |
|---------|-----|-------|---------|
| `product_id` | integer (string) | Interní ID produktu | `55` |
| `ig_code` | string | Interní kód IG (primární identifikátor etikety) | `03-01-264` |
| `ig_short_name` | string | Zkrácený název IG | `Etiketa kelímek` |
| `client_code` | string | Kód produktu u klienta | `MP-264` |
| `client_name` | string | Název produktu u klienta | `Etiketa kelímek 68x135` |
| `sku` | string | SKU | `SKU-001` |
| `product_kind` | string | Druh: typicky `iml` nebo `etikety` | `iml` |
| `label_shape_code` | string | Kód tvaru etikety | `IML049` |
| `product_format` | string | Formát (textový popis) | `68x135` |
| `format_width_mm` | decimal string | Šířka (mm) | `68.00` |
| `format_height_mm` | decimal string | Výška (mm) | `135.00` |
| `die_cut_tool_code` | string | Kód výseku / nástroje | `0007B` |
| `foil_type` | string | Typ fólie | `PP bílá` |
| `ean_code` | string | EAN | `8591234567890` |
| `item_status` | string | Stav položky v katalogu | `aktivní` |
| `pantone_codes` | string | Pantone kódy, oddělené čárkou | `Pantone 186 C, Pantone Black C` |
| `print_colors_text` | string | Souhrn barev (text) | `2 barvy` |
| `color_count` | integer (string) | Počet barev | `2` |

---

## 5. Enumy a konvence hodnot

### 5.1 `status` (objednávka)

| Hodnota | Význam |
|---------|--------|
| `nová` | Nově založená |
| `potvrzená` | Potvrzená |
| `odeslaná` | Odeslaná |
| `dokončená` | Dokončená |
| `zrušená` | Zrušená |

Hodnoty jsou **české řetězce** (ne anglické kódy). Doporučení: mapovat 1:1 nebo přes konfigurační tabulku.

### 5.2 Data

- Formát: `YYYY-MM-DD` (ISO date, bez času).
- Prázdné datum = prázdný element.

### 5.3 Desetinná čísla

- Oddělovač desetin: **tečka** (`.`).
- Bez měny v hodnotě (měna je implicitně Kč u `total` / cen).

### 5.4 `pantone_codes`

Jeden textový řetězec, kódy oddělené `, ` (čárka + mezera).

---

## 6. Doporučení pro importéry

1. **Parsujte podle názvu elementu**, ne podle pořadí – šablona může některé prvky vynechat.
2. **Klíč párování objednávky:** preferujte `order_number` (unikátní); `job_number` slouží k napojení na výrobu / plánování, pokud je vyplněné.
3. **Klíč produktu:** preferujte `ig_code`; alternativně `client_code` + zákazník, nebo `product_id` (stabilní jen v rámci APPIntegraf).
4. **Řádky:** identifikujte přes `line_id` (unikátní v rámci APPIntegraf) nebo kombinaci `order_number` + `ig_code` + pořadí.
5. **Validace:** ošetřete prázdné `job_number`, chybějící `expected_ship_date`, prázdné `Items`.
6. **Idempotence:** při opakovaném importu stejného `order_number` aktualizujte / přeskočte podle politiky cílového systému.
7. **CSV alternativa:** stejná data lze exportovat jako CSV (oddělovač `;`, UTF-8 s BOM), kde **1 řádek = 1 položka** a hlavičková pole se opakují – vhodné pro systémy bez XML parseru.

---

## 7. Získání XML

### 7.1 UI

1. IML → **Import / Export** (`/iml/imports#export`)
2. Záložka **Objednávky**
3. Formát **XML**, výběr sloupců / uložená šablona → **Spustit export**
4. Nebo na seznamu / detailu objednávky: **Export šablonou**

### 7.2 API (autentizované)

```
POST /api/iml/orders/export/run
Content-Type: application/json
Cookie / session: uživatel s oprávněním IML read
```

**Ad-hoc:**

```json
{
  "format": "xml",
  "columns": [
    { "key": "order_number" },
    { "key": "job_number" },
    { "key": "customer_name" },
    { "key": "order_date" },
    { "key": "status" },
    { "key": "quantity" },
    { "key": "ig_code" },
    { "key": "client_code" },
    { "key": "pantone_codes" }
  ],
  "filters": {
    "status": "potvrzená",
    "date_from": "2026-08-01",
    "date_to": "2026-08-31"
  }
}
```

**Ze šablony:**

```json
{
  "templateId": 12,
  "filters": { "order_ids": [142] }
}
```

(`order_ids` volitelně přepíše rozsah na konkrétní objednávky; ostatní filtry berou ze šablony.)

**Odpověď:** soubor XML (`Content-Disposition: attachment`), `Content-Type: application/xml; charset=utf-8`.

### 7.3 Filtry

| Filtr | Popis |
|-------|-------|
| `search` | Hledání v čísle objednávky / zakázky / poznámkách |
| `customer_id` | ID zákazníka |
| `status` | Stav objednávky |
| `date_from` / `date_to` | Rozsah `order_date` (`YYYY-MM-DD`) |
| `order_ids` | Pole interních ID objednávek (max. 500) |

Limit: až **2000** objednávek na jeden běh.

---

## 8. Minimální doporučená sada pro cizí systém

Pro stabilní import doporučujeme v šabloně vždy zahrnout:

**Hlavička:** `order_number`, `job_number`, `customer_name`, `order_date`, `expected_ship_date`, `status`  

**Položka:** `quantity`, `unit_price`, `subtotal`, `ig_code`, `client_code`, `client_name`, `pantone_codes`

---

## 9. Verze a kontakt

- Formát šablonového XML objednávek: **v1** (srpen 2026)
- Zdrojový kód: `lib/iml-export-order-columns.ts`, `lib/iml-export-orders-run.ts`
- Změny katalogu prvků: rozšíření whitelistu sloupců v APPIntegraf; tento manuál aktualizujte při přidání nových klíčů.

Při nejasnostech ohledně mapování na cílový systém konzultujte s IT INTEGRAF.
