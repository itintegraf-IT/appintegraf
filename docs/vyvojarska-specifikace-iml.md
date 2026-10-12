# Technická specifikace pro vývojáře: Systém IML / Workflow & Výseky

**Projekt:** Interní platforma IML (migrace z IGIS a rozšíření workflow)  
**Dokument:** Požadavky na úpravy aplikace a datový model správy výseků  
**Verze:** 1.0  
**Cílová skupina:** Vývojový tým, systémový architekt, databázový administrátor  

---

## 1. Přehled a kontext změn

Tento dokument shrnuje technické požadavky na úpravu produkčního systému IML. Implementace pokrývá:
1. **Zavedení tříúrovňového modelu správy výseků, nástrojů a montáží** pro odstranění manuálního dohledávání na prepressu a standardizaci technologických postupů.
2. **Optimalizaci workflow zakázek a UI** (přejmenování stavů, filtrace, správa nahraných souborů grafikem, řízení notifikací).
3. **Migrační a integrační procedury** (import nástrojů z Excelu, migrace dat ze starého IGISu, plán odstávky a přesunu databází).

---

## 2. Modul správy výseků a tiskových archů

### 2.1 Architektonický tříúrovňový model
Data výseků nemají vazbu 1:1 k produktu ani k fyzickému nástroji. Systém implementuje oddělení na tři úrovně:

```
[1. TVAR ETIKETY] (shape_catalog)
   Geometrie a formát (Šířka × Výška v mm), nezávislé na výrobní technologii.
         │
         ▼ (1 : N, max. 4 nástroje s prioritou)
[2. VÝSEKOVÝ NÁSTROJ] (tool_catalog)
   Fyzické železo / plech (Montex, Protlačovák Atlas, Ruční protlačovák, Příklop, Lombardi).
         │
         ▼ (1 : N)
[3. MONTÁŽ / MUSTER] (imposition_catalog)
   Předpis rozložení užitků na tiskovém archu pro Fénix / Equios (Sólo vs. Set).
         │
         ▼
[PRODUKT / ETIKETA] (products)
   Přiřazený tvar dotáhne výchozí nástroj, rozměry a montáž; doplňuje se balicí předpis.
```

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

#### B. Tabulka `tool_catalog` (Číselník výsekových nástrojů)
Fyzická železa a plechy ve výrobě (cca 150 položek).
* `id` (INT, PK, AUTO_INCREMENT): Unikátní identifikátor nástroje.
* `tool_code_new` (VARCHAR(30), UNIQUE, NOT NULL): Nové kódové označení (např. `IML0001`, `IML0012`).
* `tool_code_orig` (VARCHAR(30), NOT NULL): Původní vyražené označení používané ve Fénixu (např. `O-11`, `M07`).
* `technology` (ENUM('MONTEX', 'PROTLACOVAK_ATLAS', 'PROTLACOVAK_RUCNI', 'PRIKLOP', 'LOMBARDI'), NOT NULL): Výrobní technologie/stroj.
* `weight_50g` (DECIMAL(6,3), NULL): Hmotnost etikety při plošné hmotnosti materiálu 50 g/m².
* `weight_60g` (DECIMAL(6,3), NULL): Hmotnost etikety při plošné hmotnosti materiálu 60 g/m².
* `status` (ENUM('ACTIVE', 'MAINTENANCE', 'DECOMMISSIONED'), DEFAULT 'ACTIVE').
* `note` (TEXT, NULL): Technické poznámky (proklady, rozebíratelnost platformy pro Atlas apod.).

#### C. Tabulka `shape_tool_assignment` (Vazba Tvar ↔ Nástroje)
M:N vazba s prioritizací alternativních výrobních postupů.
* `id` (INT, PK, AUTO_INCREMENT).
* `shape_id` (INT, NOT NULL, FK -> `shape_catalog.id` ON DELETE CASCADE).
* `tool_id` (INT, NOT NULL, FK -> `tool_catalog.id` ON DELETE RESTRICT).
* `priority` (ENUM('PRIMARY', 'ALT_1', 'ALT_2', 'ALT_3'), NOT NULL, DEFAULT 'PRIMARY'): Určuje primární nástroj a až 3 záložní varianty pro případ odstávky/poruchy.
* *Unikátní klíč:* `UNIQUE(shape_id, tool_id)`.
* *Unikátní klíč:* `UNIQUE(shape_id, priority)` (každý tvar má nejvýše jeden nástroj dané priority).

#### D. Tabulka `imposition_catalog` (Číselník montáží / musterů)
Předpisy archů spravované prepressem.
* `id` (INT, PK, AUTO_INCREMENT).
* `tool_id` (INT, NOT NULL, FK -> `tool_catalog.id` ON DELETE CASCADE).
* `imposition_code` (VARCHAR(30), NOT NULL): Kód musteru ve Fénixu/Equiosu (např. `M11`, `O45`, `M27`).
* `positions_count` (INT, NOT NULL): Počet užitků na tiskovém archu.
* `layout_type` (ENUM('SOLO', 'SET'), DEFAULT 'SOLO'): Zda arch obsahuje pouze jeden tvar, nebo set (např. obvodovka + víčko).
* `description` (VARCHAR(255), NULL).

#### E. Rozšíření tabulky `products` (Etikety / Položky objednávky)
* Přidat `shape_id` (INT, NULL, FK -> `shape_catalog.id`).
* Přidat `selected_tool_id` (INT, NULL, FK -> `tool_catalog.id`).
* Přidat `selected_imposition_id` (INT, NULL, FK -> `imposition_catalog.id`).
* Přidat `box_type` (VARCHAR(50), NULL): Typ krabice (vyplňuje expedice).
* Přidat `pcs_per_box` (INT, NULL): Počet kusů v krabici.
* Přidat `boxes_per_pallet` (INT, NULL): Počet krabic na paletě.
* Přidat `pallet_weight` (DECIMAL(8,2), NULL): Celková hmotnost palety v kg.

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

-- 2. Číselník výsekových nástrojů
CREATE TABLE IF NOT EXISTS `tool_catalog` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `tool_code_new` VARCHAR(30) NOT NULL UNIQUE,
  `tool_code_orig` VARCHAR(30) NOT NULL,
  `technology` ENUM('MONTEX', 'PROTLACOVAK_ATLAS', 'PROTLACOVAK_RUCNI', 'PRIKLOP', 'LOMBARDI') NOT NULL,
  `weight_50g` DECIMAL(6,3) DEFAULT NULL,
  `weight_60g` DECIMAL(6,3) DEFAULT NULL,
  `status` ENUM('ACTIVE', 'MAINTENANCE', 'DECOMMISSIONED') DEFAULT 'ACTIVE',
  `note` TEXT DEFAULT NULL,
  INDEX `idx_tool_code_orig` (`tool_code_orig`),
  INDEX `idx_technology` (`technology`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Vazební tabulka: Tvar ↔ Nástroje s prioritou
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

-- 4. Číselník montáží
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

-- 5. Úprava existující tabulky produktů
ALTER TABLE `products`
  ADD COLUMN `shape_id` INT DEFAULT NULL AFTER `id`,
  ADD COLUMN `selected_tool_id` INT DEFAULT NULL AFTER `shape_id`,
  ADD COLUMN `selected_imposition_id` INT DEFAULT NULL AFTER `selected_tool_id`,
  ADD COLUMN `box_type` VARCHAR(50) DEFAULT NULL,
  ADD COLUMN `pcs_per_box` INT DEFAULT NULL,
  ADD COLUMN `boxes_per_pallet` INT DEFAULT NULL,
  ADD COLUMN `pallet_weight` DECIMAL(8,2) DEFAULT NULL,
  ADD CONSTRAINT `fk_prod_shape` FOREIGN KEY (`shape_id`) REFERENCES `shape_catalog` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_prod_tool` FOREIGN KEY (`selected_tool_id`) REFERENCES `tool_catalog` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_prod_imposition` FOREIGN KEY (`selected_imposition_id`) REFERENCES `imposition_catalog` (`id`) ON DELETE SET NULL;
```

---

## 3. Aplikační logika a chování uživatelského rozhraní

### 3.1 Vyloučení volného textu (Číselníky a Dropdowny)
* Všechny formuláře pro zadávání rozměrů, kódů tvarů a nástrojů musí být striktně navázány na selectboxy/našeptávače načítané z tabulek `shape_catalog` a `tool_catalog`.
* Zamezit volnému zápisu řetězců typu `15x15`, `15 x 15 mm` apod.

### 3.2 Kaskádové automatické doplňování parametrů
* Při výběru `shape_code` ve formuláři technologie etikety:
  1. Frontend automaticky zobrazí needitovatelnou šířku a výšku (`width_mm` × `height_mm`).
  2. Jako výchozí nástroj se předvybere nástroj s prioritou `PRIMARY` z `shape_tool_assignment`.
  3. Pokud existují alternativní nástroje (`ALT_1` až `ALT_3`), zobrazí se v rolovacím menu jako volitelná náhrada.
  4. Po potvrzení nástroje se automaticky načte výchozí montáž z `imposition_catalog` včetně počtu užitků na archu (`positions_count`).

### 3.3 Hromadné přiřazení v objednávce (Bulk Assign)
* V detailu klientské zakázky obsahující více položek (např. 10–20 příchutí ve stejném kelímku) implementovat multiselect (checkbox u každé položky) a akční tlačítko:
  * **„Přiřadit tvar a výsek vybraným položkám“**
  * Výběrem z číselníku se `shape_id`, primární `tool_id` i `imposition_id` hromadně zapíší do všech označených produktů bez nutnosti otevírat každou položku zvlášť.

### 3.4 Matice uživatelských rolí a oprávnění
* **Technologie (Anežka / Mája / Klára):** Založení zakázky, výběr tvaru z číselníku, potvrzení/změna primárního nástroje.
* **Prepress (Michal):** Plná správa číselníku montáží (`imposition_catalog`), párování na mustery Fénixu/Equiosu, generování CSV podkladů.
* **Výroba a expedice (Renča):** Zápis balicích předpisů (`box_type`, `pcs_per_box`, `boxes_per_pallet`, `pallet_weight`).

---

## 4. Požadované úpravy workflow, UI a komunikace

### 4.1 Změny stavů zakázky a filtrace
1. **Přejmenování stavů:**
   * `Schváleno ve frontě` ➔ **`Přijato`** (případně „Přijato do výroby“).
   * `Ve výrobě` ➔ **`U grafika`**.
   * `Hotovo` ➔ **`Hotovo grafikem`**.
   * `Schváleno` ➔ **`Schváleno klientem`**.
2. **Čištění zobrazení pro grafika:**
   * Z pohledu grafika trvale skrýt stavy `Čeká na kalkulaci` a `Čeká na schválení` (nerelevantní pro DTP).
3. **Řazení a archivace:**
   * Zakázky s příznakem **Vysoká priorita** řadit vždy na první pozice (nahoru v seznamu).
   * Přidat rychlé filtry podle stavu a priority.
   * Po finálním schválení klientem a úspěšném přenosu dat do IML zakázku automaticky odsunout z přehledu aktivních zakázek do **Archivu**.

### 4.2 Správa nahraných souborů grafikem (File Management)
* Grafik musí mít oprávnění **smazat chybně nahraný soubor** (softproof i tisková data) a nahrát opravený až do okamžiku, kdy úkol definitivně předá dál (do „odpinknutí“).
* Jakmile grafik úkol odešle na prepress/schválení, soubory se pro něj zamknou proti smazání.

### 4.3 Řízení pozastavení zakázky (Pause / Resume)
* Pokud grafik přepne úkol do stavu `Pozastaveno`, musí mít oprávnění jej po vyřešení problému **opětovně sám spustit / uvolnit**.
* Formulář pro pozastavení musí vyžadovat **povinný komentář s důvodem**.
* Pokud je důvodem chybějící podklad od klienta, přidat checkbox pro **odeslání důvodu e-mailem přímo klientovi**.

### 4.4 Tok při zamítnutí klientem (Rejection Workflow)
* Pokud klient zamítne grafiku přes klientské rozhraní:
  * Systém pošle notifikaci **přímo grafikovi (Vráťovi)** a do kopie **Anežce**.
  * Zakázka se vrátí přímo grafikovi do rozpracovaných úkolů.
  * Zachovat kontinuitu původního vlákna zakázky (nezakládat nový úkol).
  * V diskusním vlákně u reakce klienta zobrazovat přesné **časové razítko (datum a čas)** a **jméno autora/odesílatele**.

### 4.5 Pravidla notifikací a e-mailová komunikace
* **Omezení e-mailového spamu – matice notifikací:**
  * **Grafik (Vráťa):** Pouze zamítavé notifikace (od klienta nebo od Michala z prepressu).
  * **Prepress (Michal):** Pouze notifikace, že grafik dokončil etiketu (`Hotovo grafikem`).
  * **Zadavatel (Anežka):** Notifikace o schválení dat Michalem a notifikace o výsledku schválení od klienta (schváleno / zamítnuto).
* **Technické úpravy e-mailů:**
  * Změnit hlavičku odesílatele klientských e-mailů (odstranit adresu `kalendář@...`).
  * Opravit chybu zobrazování náhledů softproofů v odchozích e-mailech.
  * Automatický reminder klientovi po 7 dnech nečinnosti s obnovením platnosti odkazu.

### 4.6 UI opravy a vyhledávání
* **Tmavý motiv (Dark Theme):** Opravit nečitelné kombinace stylů (zejména červený text na žlutém pozadí) a zajistit korektní invertování všech prvků.
* **Vyhledávání:** V modulu maket doplnit vyhledávání podle číselných kódů zakázek (nejen podle hashtagů).

---

## 5. Migrační a integrační plán

### 5.1 Import nástrojů z Excelu (Fáze 1)
* Michal připraví importní skript pro cca 140–150 nástrojů z Petrova souboru:
  * Mapování polí: `tool_code_new` (IMLxxxx) ↔ `tool_code_orig` (např. O-11, Mxx) ↔ `technology` ↔ rozměry a hmotnosti 50g/60g.

### 5.2 Přechod z IGIS do IML (Fáze 2)
* Termín: Středa ráno.
* **Postup:**
  1. Dočasné odebrání zápisových práv všem běžným uživatelům ve starém IGISu (ponechat pouze read-only přístup pro nahlížení do výseků).
  2. Dávkový export dat ze starého IGISu po jednotlivých zákaznících.
  3. Spuštění částečného importu do IML s logikou ochrany metadat:
     * Pokud produkt v IML již existuje a má doplněná metadata (barevnost, schválení), import aktualizuje pouze tisková data/soubory, ale nepřepíše existující metadata.
     * Chybějící produkty se nově založí.
  4. Zpřístupnění nového IML uživatelům a trvalé odstavení zápisu do starého systému.

### 5.3 Postupné párování tvarů na existující etikety (Fáze 3)
* Z celkového počtu cca 2 500 existujících etiket neprovádět plošný automatický match (riziko chyb v desetinách mm).
* Párování proběhne průběžně při zadávání nových objednávek a reprintů technologem pomocí nového číselníku a hromadného výběru.

### 5.4 Migrace systému Cicero (Fáze 4)
* Termín: Příští týden, pátek ve 12:00.
* Odstavení staré databáze, migrace dat na nový server.
* Pátek odpoledne / sobota: Přeinstalace klientských stanic (odinstalace starého klienta, instalace nového) a dočasný ruční sběr dat ve výrobě po dobu přepojování adres.
