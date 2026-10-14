# Plán vývoje pro implementačního agenta: Systém IML & Modul grafiky

**Projekt:** Systém IML / Modul Grafika a Výseky  
**Cílová skupina:** Implementační AI agent / Vývojový tým  
**Stav notifikací:** Hotovo (vyřazeno z backlogu)  
**Verze:** 1.0 (Backlog po dokončení notifikací)  

---

## 📌 Kontext a cíle sprintu
Tento dokument slouží jako strukturované technické zadání (backlog) pro agenta nebo vývojáře realizujícího úpravy v systému IML a modulu grafiky na základě provozních požadavků z výrobní porady.

### Klíčové cíle:
1. **Import a stabilizace katalogu výseků:** Jednorázové naplnění databáze 150–160 tvary z dodaného CSV/Excelu a propojení s nástroji a materiálovými přepočty.
2. **Přílohy a náhledy (CAD/PDF):** Univerzální možnost nahrávání technických výkresů k tvarům (sólo geometrie) i výsekovým nástrojům (montáž na archu) s integrovaným PDF prohlížečem.
3. **UI/UX katalogu tvarů:** Doplnění řazení podle sloupců a filtračního panelu podle rozměrů a typů (vanička, víčko, obvodovka).
4. **Ochrana výroby a skladu (Item Locking):** Implementace automatického zamykání položek v IML při zahájení grafické úpravy, prevence chybného použití dat, varovné modaly a auditní logování.
5. **Modul Technologie:** Validace a zapracování typizovaných postupů dle kontroly z výroby.

---

## EPIC 1: Správa výseků – Hromadný import databáze z CSV/Excelu
* **Typ úkolu:** Backend / Migrace dat
* **Priorita:** Vysoká (Blokuje plnohodnotné nasazení výroby)
* **Kontext:** V ostrém provozu je nasazen tříúrovňový katalog (Tvary ➔ Nástroje ➔ Montáže). V databázi je potřeba evidovat cca 150–160 tvarů, které nelze zadávat ručně po jednom.

### Technická specifikace:
1. **Vytvoření importního parseru (CLI / Webhook / Admin endpoint):**
   * Vytvořit skript/endpoint schopný zpracovat vstupní data ve formátu CSV nebo XLSX (dodá Petr).
2. **Datové mapování vstupních polí:**
   * **Tvar etikety:** `shape_code` (např. IML-CUP-01, IML-LID-01), `shape_type` (CUP, LID, WRAP, OTHER), rozměry `width_mm` a `height_mm` (u kruhů uvádět Š × V, např. 100 × 100 mm).
   * **Zákazníci:** Namapovat přiřazené zákazníky na existující ID klientů v databázi (M:N vazba).
   * **Nástroje:** Spárovat kód tvaru s kódem nástroje (původní značení např. O-11, Mxx i nové IMLxxxx).
   * **Materiálová a balicí matice:** Importovat hmotnosti pro různé gramáže (např. 50 g/m², 60 g/m²), typ krabice, počet kusů v krabici a na paletě.
3. **Validační logika:**
   * Kontrola duplicit kódů tvarů.
   * Kontrola integrity cizích klíčů (klienti, technologie nástrojů).
   * Generování podrobného error logu pro řádky s nevalidními hodnotami.

### Akceptační kritéria:
- [ ] Jednorázový běh skriptu korektně založí 150–160 tvarů v databázi.
- [ ] Všechny importované tvary mají správně přiřazené rozměry, navázané nástroje a balicí předpisy.
- [ ] V administraci se záznamy zobrazují s korektními vazbami.

---

## EPIC 2: Univerzální správa příloh a technických výkresů (PDF / DXF / CAD / JPEG)
* **Typ úkolu:** Fullstack Feature
* **Priorita:** Střední
* **Kontext:** Kontury a technické výkresy se vážou k různým úrovním: tvar představuje 1 užitek (kontura etikety), zatímco výsekový nástroj (např. Montex nebo příklop) představuje rozmístění až 15 užitků na archu.

### Technická specifikace:
1. **Datové úložiště a schéma:**
   * Přidat podporu pro ukládání příloh k entitě `Tvar etikety` (sólo geometrie / kontura).
   * Přidat podporu pro ukládání příloh k entitě `Výsekový nástroj` (výkres rozmístění nástroje na archu).
   * Podporované formáty souborů: `.pdf`, `.dxf`, `.dwg`, `.cad`, `.jpg`, `.png`.
2. **Backend API:**
   * Endpoint pro upload souboru: `POST /api/shapes/{id}/attachments` a `POST /api/tools/{id}/attachments`.
   * Endpoint pro stažení a smazání souboru.
3. **Frontend komponenta náhledu (PDF Viewer):**
   * V detailu tvaru i nástroje implementovat inline okno nebo modal pro přímé zobrazení PDF výkresu bez nutnosti stahovat soubor na lokální disk.

### Akceptační kritéria:
- [ ] Uživatel může k libovolnému tvaru nahrát soubor kontury (PDF/DXF).
- [ ] Uživatel může k výsekovému nástroji nahrát výkres archu.
- [ ] V detailu záznamu funguje okamžitý náhled nahraného PDF souboru v modalu.

---

## EPIC 3: UI/UX – Řazení a pokročilá filtrace v katalogu tvarů
* **Typ úkolu:** Frontend / UI
* **Priorita:** Střední
* **Kontext:** V aktuálním seznamu tvarů chybí možnost kliknutím seřadit data podle sloupců a vyhledávání podle rozměrů a typů je nepřehledné.

### Technická specifikace:
1. **Řazení podle sloupců (Data Grid Sorting):**
   * Implementovat interaktivní záhlaví tabulky pro řazení (vzestupně/sestupně) podle sloupců: Kód tvaru, Název, Typ (CUP, LID, WRAP), Šířka, Výška.
2. **Filtrační panel (ve stylu modulu produktů):**
   * **Dropdown filtr podle typu:** Vanička (CUP), Víčko (LID), Obvodovka (WRAP), Ostatní.
   * **Filtrování podle rozměrů:** Textová pole pro zadání šířky a výšky v mm (pro kruhové výseky vyhledávat zadáním shodných hodnot, např. 100 × 100 mm).
   * Fulltextové vyhledávání v interní poznámce a kódu klienta.

### Akceptační kritéria:
- [ ] Kliknutí na záhlaví sloupce tabulky seřadí záznamy vzestupně/sestupně.
- [ ] Výběr filtru „Víčko“ okamžitě omezí zobrazení pouze na víčka.
- [ ] Zadání rozměru 100 × 100 mm zobrazí odpovídající kruhové výseky.

---

## EPIC 4: Ochrana výroby – Automatické zamykání položek v IML při úpravě grafiky
* **Typ úkolu:** Backend & Frontend / Bezpečnost procesů
* **Priorita:** Kritická (Prevence finančních škod a chyb ve skladu SHV)
* **Kontext:** Pokud klient objedná úpravu existující grafiky, systém nesmí dovolit stažení starých dat do výroby bez explicitního varování a nesmí dojít k nechtěné likvidaci vyrobeného zboží ve skladu.

### Architektonický průchod (Workflow):
```
[Zadání požadavku v Modulu grafiky]
                 │
                 ▼
         Typ: "Úprava dat"
                 │
                 ▼
[Povinný výběr položky z databáze IML]
                 │
                 ▼
[Automatické uzamčení položky v IML] ──> Příznak: is_locked = TRUE
                 │                       Status: "Rozpracováno grafikem"
                 ▼
         [Výrobní operace]
                 │
     Pokus o stažení / tisk dat?
                 │
                 ▼
     [Zobrazení varovného modalu]
  "Pozor: Data jsou v úpravě grafikem!"
                 │
    Potvrzení uživatelem? ──> ANO ──> [Audit Log: User ID + Timestamp + Důvod]
                 │
                 ▼
[Klient schválil nová data v grafice]
                 │
                 ▼
[Automatické odemčení v IML + přepis ostrých dat]
```

### Technická specifikace:
1. **Formulář zadání grafiky:**
   * Při volbě typu požadavku `Úprava stávajících dat` se pole pro výběr položky z IML stává **povinným** (validace nedovolí formulář odeslat prázdný).
2. **Mechanismus zámku v databázi IML:**
   * V tabulce `products` nastavit příznak `is_locked = TRUE` a stav `IN_GRAPHIC_REVISION`.
   * V UI přehledu produktů označit položku nepřehlédnutelnou výstražnou ikonou (např. oranžový zámek s popisem „V úpravě grafikem“).
3. **Intercepce akce stažení tiskových dat:**
   * Při pokusu o stažení výrobního PDF / podkladů pro zamčenou položku backend/frontend zobrazí modální okno:
     > **Varování:** *„Upozornění: Tato položka je aktuálně v úpravě grafikem. Opravdu chcete stáhnout a použít stávající data pro výrobu?“*
   * Uživatel musí volbu potvrdit tlačítkem (vyžadováno dvojí potvrzení).
4. **Auditní logování (`audit_log`):**
   * Pokud uživatel přes varování data stáhne, vytvoří se záznam v tabulce auditního logu: `user_id`, `product_id`, `action = 'DOWNLOAD_LOCKED_DATA'`, `timestamp`, `ip_address`.
5. **Uvolnění zámku:**
   * Po kompletním schválení grafiky klientem i prepressem a překlopení do IML se položka automaticky odemkne (`is_locked = FALSE`), data se přepíšou na novou verzi a stav se vrátí do `ACTIVE`.

### Akceptační kritéria:
- [ ] Požadavek na úpravu dat nelze zadat bez vazby na konkrétní položku z IML.
- [ ] Dotčená položka v IML je ihned uzamčena a vizuálně označena.
- [ ] Při pokusu o stažení dat se zobrazí varovný dialog.
- [ ] Každé autorizované stažení zamčených dat je zapsáno do auditního logu.
- [ ] Po finálním schválení nové grafiky se položka automaticky odemkne a data zaktualizují.

---

## EPIC 5: Modul Technologie (3D modely)
* **Typ úkolu:** Údržba / Validace
* **Priorita:** Nízká
* **Kontext:** Modul technologie vycházející z 3D modelů byl do systému nasazen a čeká na ověření výroby.

### Technická specifikace:
1. **Ověření a revize:**
   * Provést revizi nadefinovaných technologických postupů na základě připomínek od p. Jarošáka.
2. **Oprava typizovaných šablon:**
   * Upravit parametry technologií a validační pravidla dle schválených výrobních standardů.

---

## 📅 Doporučený implementační postup (Agent Roadmap)

| Fáze | Epic | Název | Odhad náročnosti |
| :--- | :--- | :--- | :--- |
| **Fáze 1** | **EPIC 4** | Ochrana výroby – Automatické zamykání položek v IML | 2–3 dny |
| **Fáze 2** | **EPIC 1** | Importní skript pro 150–160 tvarů z CSV/Excelu | 1–2 dny |
| **Fáze 3** | **EPIC 2** | Univerzální přílohy (PDF/CAD) a inline PDF prohlížeč | 2 dny |
| **Fáze 4** | **EPIC 3** | Řazení podle sloupců a filtrační panel v katalogu tvarů | 1 den |
| **Fáze 5** | **EPIC 5** | Úpravy modulu Technologie dle revize p. Jarošáka | 1 den |
