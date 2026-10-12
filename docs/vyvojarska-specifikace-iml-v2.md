# Technická specifikace pro vývojáře: Systém IML / Workflow & Výseky

**Projekt:** Interní platforma IML (migrace z IGIS a rozšíření workflow)  
**Dokument:** Požadavky na úpravy aplikace a datový model správy výseků  
**Verze:** 2.0 (Doplněno o upřesnění materiálové matice, kaskádních vazeb a hromadných operací)  
**Cílová skupina:** Vývojový tým, systémový architekt, databázový administrátor  

---

## 1. Přehled a kontext změn

Tento dokument shrnuje technické požadavky na úpravu produkčního systému IML na základě výrobních porad a revize technologických postupů:
1. **Zavedení tříúrovňového modelu správy výseků, nástrojů a montáží** s jednoznačným oddělením zodpovědností jednotlivých entit.
2. **Implementace materiálově-balicí matice vázané na Tvar etikety**, která reflektuje odlišné hmotnosti a objemy krabic dle použité gramáže a automaticky se propisuje do produktů.
3. **Kaskádové automatické doplňování parametrů** (Tvar ➔ Nástroj ➔ Montáž ➔ Počet pozic na archu).
4. **Hromadné operace a provázání s modulem grafiky** (řazení etiket podle formátu pro hromadné přiřazení tvaru; povinné přiřazení tvaru před překlopením schválené grafiky do IML).
5. **Optimalizace workflow zakázek a UI** (přejmenování stavů, filtrace, správa nahraných souborů grafikem, řízení notifikací).
6. **Migrační procedury a provozní poznámky** (import nástrojů z Excelu, migrace dat z IGISu, provoz systému Cicero).

---

## 2. Modul správy výseků a tiskových archů

### 2.1 Architektonický tříúrovňový model a materiálová matice
Data výseků nemají vazbu 1:1 k produktu ani k fyzickému nástroji. Systém implementuje oddělení do tří úrovní, doplněné o materiálovou tabulku balení:

```
[1. TVAR ETIKETY] (shape_catalog)
   - Kód tvaru (IML-CUP-01, IML-LID-01...)
   - Interní název
   - Formát výseku (Šířka × Výška v mm)
   - Zákazníci (multiselect, nepovinné)
         │
         ├───► [MATERIÁLOVÁ & BALICÍ MATICE] (shape_material_packaging)
         │     Materiál (EUP60, EUP50, ETH, LR...) ➔ Hmotnost, Ks v krabici, Ks na paletě, Typ krabice
         │     (Automaticky se propisuje do všech etiket daného tvaru; v produktu read-only)
         │
         ▼ (1 : N, výběr PRIMARY a ALT_1..3)
[2. VÝSEKOVÝ NÁSTROJ] (tool_catalog)
   - Kód nástroje (IML0001 / O-11)
   - Výrobní technologie a primární výsekový stroj
         │
         ▼ (1 : N)
[3. MONTÁŽ / MUSTER] (imposition_catalog)
   - Kód montáže pro Fénix / Equios (M11, O45...)
   - Počet pozic na tiskovém archu (užitky)
   - Typ rozložení (Sólo vs. Set)
         │
         ▼
[PRODUKT / ETIKETA] (products)
   - Přiřazený tvar automaticky předvyplní rozměry, nástroj, montáž, užitky a materiálové parametry.
   - Obsluha doplňuje pouze specifika tiskových dat pro Fénix a barevnost.
```

---

### 2.2 Datový slovník (Data Dictionary)

#### A. Tabulka `shape_catalog` (Číselník tvarů etiket)
Definuje geometrický tvar a formát etikety.
* `id` (INT, PK, AUTO_INCREMENT): Unikátní identifikátor tvaru.
* `shape_code` (VARCHAR(30), UNIQUE, NOT NULL): Kód tvaru s prefixem typu (např. `IML-CUP-01`, `IML-LID-01`, `IML-WRAP-01`).
* `shape_type` (ENUM('CUP', 'LID', 'WRAP', 'OTHER'), NOT NULL): Typ tvaru (vanička, víčko, obvodovka, jiné).
* `width_mm` (DECIMAL(6,2), NOT NULL): Šířka výseku v mm.
* `height_mm` (DECIMAL(6,2), NOT NULL): Výška výseku v mm (i pro kruhová víčka uvádět Š × V, např. 100.00 × 100.00 kvůli Fénixu).
* `internal_note` (VARCHAR(255), NULL): Volné textové pole pro zvykové názvy (např. „banány“, specifický kód klienta).
* `drawing_file_path` (VARCHAR(255), NULL): Relativní cesta k technickému výkresu / PDF / CAD.
* `created_at` (TIMESTAMP, DEFAULT CURRENT_TIMESTAMP).
* `updated_at` (TIMESTAMP, DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP).

#### B. Tabulka `shape_customer_assignment` (Přiřazení zákazníků ke tvaru)
Umožňuje přiřadit ke tvaru více zákazníků (multiselect), pole je nepovinné (např. standardní víčka používaná pro 2–4 klienty). Neřeší se primární zákazník.
* `id` (INT, PK, AUTO_INCREMENT).
* `shape_id` (INT, NOT NULL, FK -> `shape_catalog.id` ON DELETE CASCADE).
* `customer_id` (INT, NOT NULL, FK -> `customers.id` ON DELETE CASCADE).
* *Unikátní klíč:* `UNIQUE(shape_id, customer_id)`.

#### C. Tabulka `shape_material_packaging` (Materiálová a balicí matice tvaru)
Definuje přepočty hmotností a balicích předpisů pro jednotlivé materiály přímo ke tvaru etikety. Zadává se jednou u tvaru a propisuje se do všech přiřazených etiket.
* `id` (INT, PK, AUTO_INCREMENT).
* `shape_id` (INT, NOT NULL, FK -> `shape_catalog.id` ON DELETE CASCADE).
* `material_code` (VARCHAR(30), NOT NULL): Kód materiálu (např. `EUP60`, `EUP50`, `ETH`, `LR`, `LL001`).
* `weight_per_thousand` (DECIMAL(8,3), NOT NULL DEFAULT 0.000): Hmotnost v gramech (např. 480.000 g / 1000 ks).
* `pcs_per_box` (INT, NOT NULL DEFAULT 0): Počet kusů v krabici (např. u 60g materiálu 4000 ks, u 50g 5000 ks).
* `pcs_per_pallet` (INT, NOT NULL DEFAULT 0): Počet kusů na paletě.
* `box_type` (VARCHAR(50), NULL): Typ / rozměr použité krabice.
* *Unikátní klíč:* `UNIQUE(shape_id, material_code)`.

#### D. Tabulka `tool_catalog` (Číselník výsekových nástrojů)
Fyzická železa a plechy ve výrobě (cca 150 položek).
* `id` (INT, PK, AUTO_INCREMENT): Unikátní identifikátor nástroje.
* `tool_code_new` (VARCHAR(30), UNIQUE, NOT NULL): Nové kódové označení (např. `IML0001`, `IML0012`).
* `tool_code_orig` (VARCHAR(30), NOT NULL): Původní vyražené označení používané ve Fénixu (např. `O-11`, `M07`).
* `technology` (ENUM('MONTEX', 'PROTLACOVAK_ATLAS', 'PROTLACOVAK_RUCNI', 'PRIKLOP', 'LOMBARDI'), NOT NULL): Výrobní technologie.
* `primary_machine` (VARCHAR(50), NULL): Primární výsekový stroj vázaný na nástroj.
* `status` (ENUM('ACTIVE', 'MAINTENANCE', 'DECOMMISSIONED'), DEFAULT 'ACTIVE').
* `note` (TEXT, NULL): Technické poznámky k nástroji.

#### E. Tabulka `shape_tool_assignment` (Vazba Tvar ↔ Nástroje s prioritou)
* `id` (INT, PK, AUTO_INCREMENT).
* `shape_id` (INT, NOT NULL, FK -> `shape_catalog.id` ON DELETE CASCADE).
* `tool_id` (INT, NOT NULL, FK -> `tool_catalog.id` ON DELETE RESTRICT).
* `priority` (ENUM('PRIMARY', 'ALT_1', 'ALT_2', 'ALT_3'), NOT NULL DEFAULT 'PRIMARY'): Určuje primární nástroj a až 3 záložní varianty.
* *Unikátní klíč:* `UNIQUE(shape_id, tool_id)`.
* *Unikátní klíč:* `UNIQUE(shape_id, priority)`.

#### F. Tabulka `imposition_catalog` (Číselník montáží / musterů)
Předpisy archů spravované prepressem vázané na výsekový nástroj.
* `id` (INT, PK, AUTO_INCREMENT).
* `tool_id` (INT, NOT NULL, FK -> `tool_catalog.id` ON DELETE CASCADE).
* `imposition_code` (VARCHAR(30), NOT NULL): Kód musteru ve Fénixu/Equiosu (např. `M11`, `O45`, `M27`).
* `positions_count` (INT, NOT NULL): Počet užitků na tiskovém archu.
* `layout_type` (ENUM('SOLO', 'SET'), DEFAULT 'SOLO'): Rozložení na archu.
* `description` (VARCHAR(255), NULL).

#### G. Tabulka `products` (Etikety / Položky v IML)
* `shape_id` (INT, NULL, FK -> `shape_catalog.id`): Přiřazený tvar etikety.
* `selected_tool_id` (INT, NULL, FK -> `tool_catalog.id`): Zvolený nástroj.
* `selected_imposition_id` (INT, NULL, FK -> `imposition_catalog.id`): Zvolená montáž.
* `raw_data_width_mm` (DECIMAL(6,2), NULL): Velikost čistých grafických dat pro Fénix.
* `raw_data_height_mm` (DECIMAL(6,2), NULL): Velikost čistých grafických dat pro Fénix.
* `colors_spec` (VARCHAR(100), NULL): Barevnost etikety.

---

### 2.3 SQL DDL Schéma (MySQL / MariaDB)

```sql
-- 1. Číselník tvarů
CREATE TABLE IF NOT EXISTS `shape_catalog` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `shape_code` VARCHAR(30) NOT NULL UNIQUE,
  `shape_type` ENUM('CUP', 'LID', 'WRAP', 'OTHER') NOT NULL,
  `width_mm` DECIMAL(6,2) NOT NULL,
  `height_mm` DECIMAL(6,2) NOT NULL,
  `internal_note` VARCHAR(255) DEFAULT NULL,
  `drawing_file_path` VARCHAR(255) DEFAULT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_shape_type` (`shape_type`),
  INDEX `idx_dimensions` (`width_mm`, `height_mm`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Přiřazení zákazníků ke tvaru (multiselect, volitelné)
CREATE TABLE IF NOT EXISTS `shape_customer_assignment` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `shape_id` INT NOT NULL,
  `customer_id` INT NOT NULL,
  UNIQUE KEY `uniq_shape_customer` (`shape_id`, `customer_id`),
  CONSTRAINT `fk_sca_shape` FOREIGN KEY (`shape_id`) REFERENCES `shape_catalog` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Materiálová a balicí matice tvaru
CREATE TABLE IF NOT EXISTS `shape_material_packaging` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `shape_id` INT NOT NULL,
  `material_code` VARCHAR(30) NOT NULL,
  `weight_per_thousand` DECIMAL(8,3) NOT NULL DEFAULT 0.000,
  `pcs_per_box` INT NOT NULL DEFAULT 0,
  `pcs_per_pallet` INT NOT NULL DEFAULT 0,
  `box_type` VARCHAR(50) DEFAULT NULL,
  UNIQUE KEY `uniq_shape_material` (`shape_id`, `material_code`),
  CONSTRAINT `fk_smp_shape` FOREIGN KEY (`shape_id`) REFERENCES `shape_catalog` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Číselník výsekových nástrojů
CREATE TABLE IF NOT EXISTS `tool_catalog` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `tool_code_new` VARCHAR(30) NOT NULL UNIQUE,
  `tool_code_orig` VARCHAR(30) NOT NULL,
  `technology` ENUM('MONTEX', 'PROTLACOVAK_ATLAS', 'PROTLACOVAK_RUCNI', 'PRIKLOP', 'LOMBARDI') NOT NULL,
  `primary_machine` VARCHAR(50) DEFAULT NULL,
  `status` ENUM('ACTIVE', 'MAINTENANCE', 'DECOMMISSIONED') DEFAULT 'ACTIVE',
  `note` TEXT DEFAULT NULL,
  INDEX `idx_tool_code_orig` (`tool_code_orig`),
  INDEX `idx_technology` (`technology`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. Vazební tabulka: Tvar ↔ Nástroje s prioritou
CREATE TABLE IF NOT EXISTS `shape_tool_assignment` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `shape_id` INT NOT NULL,
  `tool_id` INT NOT NULL,
  `priority` ENUM('PRIMARY', 'ALT_1', 'ALT_2', 'ALT_3') NOT NULL DEFAULT 'PRIMARY',
  UNIQUE KEY `uniq_shape_tool` (`shape_id`, `tool_id`),
  UNIQUE KEY `uniq_shape_priority` (`shape_id`, `priority`),
  CONSTRAINT `fk_sta_shape` FOREIGN KEY (`shape_id`) REFERENCES `shape_catalog` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_sta_tool` FOREIGN KEY (`tool_id`) REFERENCES `tool_catalog` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. Číselník montáží
CREATE TABLE IF NOT EXISTS `imposition_catalog` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `tool_id` INT NOT NULL,
  `imposition_code` VARCHAR(30) NOT NULL,
  `positions_count` INT NOT NULL,
  `layout_type` ENUM('SOLO', 'SET') NOT NULL DEFAULT 'SOLO',
  `description` VARCHAR(255) DEFAULT NULL,
  INDEX `idx_imposition_code` (`imposition_code`),
  CONSTRAINT `fk_ic_tool` FOREIGN KEY (`tool_id`) REFERENCES `tool_catalog` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 7. Úprava tabulky produktů
ALTER TABLE `products`
  ADD COLUMN `shape_id` INT DEFAULT NULL AFTER `id`,
  ADD COLUMN `selected_tool_id` INT DEFAULT NULL AFTER `shape_id`,
  ADD COLUMN `selected_imposition_id` INT DEFAULT NULL AFTER `selected_tool_id`,
  ADD COLUMN `raw_data_width_mm` DECIMAL(6,2) DEFAULT NULL,
  ADD COLUMN `raw_data_height_mm` DECIMAL(6,2) DEFAULT NULL,
  ADD COLUMN `colors_spec` VARCHAR(100) DEFAULT NULL,
  ADD CONSTRAINT `fk_prod_shape` FOREIGN KEY (`shape_id`) REFERENCES `shape_catalog` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_prod_tool` FOREIGN KEY (`selected_tool_id`) REFERENCES `tool_catalog` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_prod_imposition` FOREIGN KEY (`selected_imposition_id`) REFERENCES `imposition_catalog` (`id`) ON DELETE SET NULL;
```

---

## 3. Aplikační logika a chování uživatelského rozhraní

### 3.1 Vyloučení volného textu (Číselníky a Dropdowny)
* Všechna pole pro tvary, nástroje a montáže musí být striktně řešena výběrem z předem definovaných číselníků.
* Zamezit volnému zápisu řetězců typu `15x15`, `15 x 15 mm` apod.

### 3.2 Kaskádové automatické doplňování parametrů
1. **Výběr tvaru (`shape_code`):**
   * Automaticky zobrazí needitovatelný formát výseku (`width_mm` × `height_mm`).
   * Nabídne předvybraný nástroj s prioritou `PRIMARY`. Alternativní nástroje (`ALT_1` až `ALT_3`) jsou k dispozici v rolovacím menu.
2. **Kaskáda Nástroj ➔ Montáž ➔ Užitky:**
   * Výběrem nástroje se **automaticky vybere přiřazená montáž** z `imposition_catalog`.
   * Z montáže se **automaticky dotáhne počet pozic na archu** (`positions_count`).
   * Uživatel nemusí zadávat železo i montáž zvlášť.
3. **Zobrazení materiálové matice v detailu produktu:**
   * V kartě produktu (záložka „Materiály“ / „Výseky a materiály“) se zobrazuje needitovatelná přehledová tabulka hodnot z `shape_material_packaging` (hmotnosti, krabice, palety pro jednotlivé gramáže EUP60, EUP50 atd.).
   * Uživatelé tak ihned vidí celkovou hmotnost a logistické parametry pro zadaný náklad.

### 3.3 Hromadné přiřazení tvaru v seznamu produktů (Bulk Assign podle formátu)
* V přehledu všech produktů/etiket implementovat:
  1. **Řazení a filtrování podle rozměrů/formátu etiket**.
  2. Checkboxy pro hromadný výběr (např. označení 20–30 etiket se shodným rozměrem).
  3. Akční tlačítko **„Přiřadit tvar vybraným položkám“** s výběrem z číselníku `shape_catalog`.
  4. Po potvrzení se všem označeným etiketám hromadně nastaví `shape_id`, výchozí nástroj, montáž i materiálové předpisy.

### 3.4 Workflow schválení grafiky a předání do modulu IML
* Po schválení grafiky klientem v modulu maket se zakázka vrací zadavateli (Anežce).
* **Zamezení slepého překlopení:** Před odesláním zakázky do modulu IML musí být povinně vybrán **kód tvaru etikety** (`shape_code`).
* Po překlopení do IML má nová etiketa předvyplněný tvar, rozměry výseku, nástroj i montáž. Obsluha v IML doplňuje pouze tiskový formát dat pro Fénix a barevnost.

### 3.5 Správa zákazníků u tvaru
* Výběr zákazníka u karty tvaru je **nepovinný**.
* Rozhraní nabízí multiselect (checkboxy pro výběr např. až 4 klientů), protože stejný tvar (např. standardní kulaté víčko) je často sdílen více zákazníky. Pole pro „primárního zákazníka“ se neeviduje.

### 3.6 Matice uživatelských rolí a oprávnění
* **Technologie (Anežka / Mája / Klára):** Založení zakázky, výběr tvaru z číselníku, potvrzení/změna primárního nástroje, doplnění tvaru při překlápění z grafiky.
* **Prepress (Michal):** Správa číselníku montáží (`imposition_catalog`), mustery ve Fénixu/Equiosu, generování exportních CSV.
* **Výroba a expedice (Renča):** Kontrola a zadávání balicích předpisů u tvarů a materiálů.

---

## 4. Požadované úpravy workflow, UI a komunikace

### 4.1 Změny stavů zakázky a filtrace
1. **Přejmenování stavů:**
   * `Schváleno ve frontě` ➔ **`Přijato`** (případně „Přijato do výroby“).
   * `Ve výrobě` ➔ **`U grafika`**.
   * `Hotovo` ➔ **`Hotovo grafikem`**.
   * `Schváleno` ➔ **`Schváleno klientem`**.
2. **Čištění zobrazení pro grafika:**
   * Skrýt stavy `Čeká na kalkulaci` a `Čeká na schválení`.
3. **Řazení a archivace:**
   * Zakázky s **Vysokou prioritou** řadit automaticky na začátek seznamu (nahoru).
   * Rychlé filtry podle stavu a priority.
   * Po schválení klientem a přenosu do IML přesunout zakázku do **Archivu**.

### 4.2 Správa nahraných souborů grafikem (File Management)
* Grafik může **smazat chybně nahraný soubor** (softproof i data) a nahradit jej opraveným až do okamžiku předání úkolu dál (do „odpinknutí“). Poté se soubory uzamknou.

### 4.3 Řízení pozastavení zakázky (Pause / Resume)
* Grafik může zakázku pozastavit i **opětovně sám spustit / uvolnit**.
* Povinný komentář s důvodem; možnost odeslat důvod e-mailem klientovi při chybějících podkladech.

### 4.4 Tok při zamítnutí klientem (Rejection Workflow)
* Při zamítnutí klientem: notifikace přímo grafikovi (Vráťovi) a v kopii Anežce.
* Zachovat kontinuitu vlákna (nezakládat nový úkol).
* U reakce klienta zobrazovat přesné **datum, čas a autora zprávy**.

### 4.5 Pravidla notifikací a e-maily
* **Vráťa (grafik):** Pouze zamítavé notifikace (od klienta či z prepressu).
* **Michal (prepress):** Pouze notifikace `Hotovo grafikem`.
* **Anežka (zadavatel):** Schválení Michalem a schválení/zamítnutí od klienta.
* Odstranit odesílatele `kalendář@...`, opravit náhledy softproofů v e-mailech.

### 4.6 UI opravy
* **Tmavý motiv:** Opravit nečitelné styly (červený text na žlutém pozadí).
* **Vyhledávání:** V modulu maket vyhledávat podle číselných kódů zakázek.

---

## 5. Migrační a integrační plán

### 5.1 Import nástrojů z Excelu (Fáze 1)
* Jednorázový import cca 140–150 nástrojů z Petrova souboru do `tool_catalog`.

### 5.2 Přechod z IGIS do IML (Fáze 2)
* Termín: Středa ráno.
* Read-only přístup pro uživatele ve starém IGISu, dávkový export po zákaznících a import do IML s ochranou existujících metadat.

### 5.3 Párování tvarů na existující etikety (Fáze 3)
* Z cca 2 500 existujících etiket provádět párování postupně při nových objednávkách a reprintech s využitím hromadného přiřazení podle rozměrů v seznamu produktů.

### 5.4 Systém Cicero – provozní stav
* Migrace databáze Cicero na nový server byla dokončena, systém je ve finálním stavu.
* **Upozornění:** Systém vykazuje nižší rychlost než před migrací – doporučeno provést dodatečnou diagnostiku a optimalizaci síťového spojení / indexů.
