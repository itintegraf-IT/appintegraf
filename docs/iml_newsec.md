Technická specifikace: Moduly IML pro poptávky, správu produktů a výrobu
1. Cíl dokumentu a přehled systému
Tento dokument definuje technické a funkční požadavky na implementaci systému pro správu IML (In-Mold Labeling) produkce. Cílem je vytvoření robustního řešení pro evidenci klientských dat, technickou správu produktů a optimalizaci procesu objednávek od poptávky až po kalkulaci spotřebních materiálů.
Klíčové moduly:
•	Zákazníci: Evidence klientských dat a logistických specifikací.
•	Produkty: Technické karty (katalog) s podrobnou specifikací parametrů a barevnosti.
•	Poptávky (Inquiries): Evidence poptávkových řízení s workflow pro konverzi do výroby.
•	Objednávky: Výrobní modul s integrací na sklad a importními nástroji.
2. Modul: Zákazníci (Správa klientských dat)
Centrální evidence odběratelů s důrazem na logistickou variabilitu a specifické výrobní požadavky.
2.1 Základní parametry
Pole	Datový typ / Formát	Poznámka
Název	String	Obchodní jméno
E-mail	Email	Hlavní kontakt pro komunikaci
Kontaktní osoba	String	Jméno odpovědného zástupce
Telefon	String (Phone)	Mezinárodní formát
Fakturační adresa	Text/Object	Trvalé sídlo
2.2 Správa doručovacích adres (Vazba 1:N)
Systém musí podporovat více doručovacích míst pro jednoho zákazníka.
•	Filtrování: Při výběru adresy v objednávce musí systém nabízet pouze adresy asociované s daným Customer_ID.
•	Primární adresa: Možnost definovat jeden záznam jako výchozí (default).
•	Data Integrity (Snapshot): Při vytvoření objednávky musí systém vytvořit statický záznam (snapshot) vybrané doručovací adresy. Historická změna adresy na kartě zákazníka nesmí ovlivnit již uzavřené nebo probíhající objednávky.
2.3 Individuální požadavky a routování
Specifická textová pole pro interní instrukce, která se automaticky přenášejí do příslušných pohledů:
•	Požadavky na štítky: (Logistika) – Specifikace značení.
•	Balení palet: (Sklad/Expedice) – Způsob stohování a balení.
•	Úprava grafických dat: (Prepress) – Poznámky pro grafické oddělení.
3. Modul: Produkty (Katalog a technické karty)
Produktová karta je strukturována do záložek (tabů) pro oddělení obchodních, technických a grafických dat.
3.1 Záložka 1: Identifikace
•	Kód/ID zákazníka: Interní identifikátor.
•	Název produktu / Zkrácený název.
•	Kód klienta / Název u klienta: Pro křížovou referenci v komunikaci s odběratelem.
•	Zadavatel: Subjekt objednávající výrobu (může se lišit od koncového zákazníka).
•	SKU: Pole vyhrazeno pro budoucí ERP integraci (nepovinné/volitelné).
3.2 Záložka 2: Výseky a montáže
Technický parametr	Popis
Kód tvaru etikety	Geometrická specifikace
Rozměr a Formát	Fyzické rozměry produktu
Kód výsekového nástroje	Vazba na fyzický nástroj v archivu
Kód montáže	Specifikace uspořádání archu
Počet pozic na archu	Počet etiket z jednoho tiskového archu
Kusy v krabici / na paletě	Logistické parametry
3.3 Záložka 3: Materiály a tisk
•	Fólie: Dropdown navázaný na centrální databázi materiálů (sklad fólií).
•	EAN: Pole pro kód etikety s podporou čtečky (validace vstupu).
•	Vzorek: Checkbox indikující fyzickou existenci odsouhlaseného vzorku (vazba na Prepress).
3.4 Záložka 4: Tisková data a schvalování
•	Náhledový obrázek: Formáty JPG/PNG pro UI vizualizaci.
•	Tisková data: PDF přílohy (max. limit 50 MB na soubor).
4. Logika správy barev a výpočet spotřeby
Systém řeší evidenci barevnosti s důrazem na přímé barvy (Pantone).
4.1 UI a validace Pantone barev
•	Vyloučení CMYK: Standardní barvotisk (CMYK) se eviduje pouze jako příznak barevnosti, nevstupuje do algoritmu výpočtu kg-spotřeby (řešeno měsíčním koeficientem).
•	Dynamické řádky: UI obsahuje tlačítko "+" pro přidávání Pantone barev.
•	Smart Entry Logic: Při stisku klávesy [Enter] v poli "Kód barvy" se kurzor automaticky přesune do pole "Pokrytí (%)".
•	Normalizace: Systém provádí automatickou normalizaci textu na Uppercase (např. "p 1234" se uloží jako "P 1234").
•	Validace v DB: Pokud zadaný kód v DB neexistuje, systém nabídne administrátorovi vytvoření nové karty s validací formátu.
4.2 Algoritmus výpočtu spotřeby barvy
Výpočet odhadované spotřeby tiskové barvy v kg pro každou jednotlivou Pantone barvu:
•	Základní konstanta: 0,05 kg (5 dkg) na 1 000 etiket při 50% pokrytí.
•	Vzorec: Spotřeba (kg) = (Počet kusů v objednávce / 1000) * (Pokrytí % / 50) * 0,05
•	Poznámka: Výpočet se provádí na úrovni finálních etiket (kusů), nikoliv tiskových archů.
5. Workflow a stavy dat
Zajištění integrity výrobního procesu pomocí stavového automatu.
5.1 Číselník stavů schválení
•	Aktivní: Schváleno pro výrobu.
•	Archivní: Historická data, nepoužívat.
•	Testovací: Pouze pro zkušební nátisky.
•	Zablokovaná: Chyba v datech, zákaz použití.
•	Rozpracováno grafikem: Prepress proces, neschváleno pro tisk.
•	Chyba: Technická nekonzistence.
5.2 Verzování a logování
•	Logování: Systém eviduje každou změnu u tiskových dat (Upload/Delete) ve formátu Uživatel | Časové razítko | Název souboru.
•	Verzování PDF: Automatická inkrementace verzí (1, 2, 3...) při nahrání nového souboru. Systém uchovává pouze aktuální verzi jako primární, starší verze jsou dostupné v historii (logu).
5.3 Výrobní validace
Při pokusu o vložení produktu do objednávky, který není ve stavu "Aktivní", systém zobrazí blokující varování a neumožní generování výrobních podkladů bez autorizace supervizorem.
6. Modul: Poptávky (Inquiries)
Samostatný modul pro obchodní přípravu.
•	Struktura: Identická pole jako u modulu Objednávky.
•	Konverze: Funkce "Překlopit do objednávky" – jednosměrný přenos dat z poptávky do nové objednávky po jejím schválení klientem.
•	Analytika: Evidence historie všech poptávek pro sledování konverzního poměru (úspěšnosti nabídek).
7. Modul: Objednávky a UI požadavky
Optimalizace pro rychlé zadávání dat (tzv. "Smart UI").
7.1 Výběr produktů (Auto-load Table)
•	Namísto standardního dropdownu se po výběru zákazníka automaticky vygeneruje tabulkový seznam všech produktů daného zákazníka.
•	In-line editace: Uživatel zadává požadované množství (Quantity) přímo do řádku v tabulce produktů.
•	Vyhledávání: Implementována "lupa" a našeptávač (type-ahead) reagující na kód nebo název produktu od 3. znaku.
7.2 Importy a sklad
•	CSV/Excel Import: Mapování polí pro hromadné nahrávání zakázek.
•	Skladové zásoby: Pole pro manuální evidenci množství etiket skladem (informativní hodnota pro rychlý přehled).
8. Reportování a analýzy barev
Nástroj pro plánování nákupu materiálů, zejména pro potřeby plánování nákupu barev (každý den v 11:00).
8.1 Report: Četnost barev a plánovaná spotřeba
Report agreguje data napříč všemi zákazníky a produkty pro optimalizaci bulk nákupů.
Filtr	Výstupní sloupce	Agregace
Kód Pantone barvy	Název produktu / Zákazník	Suma (kg) dle objednávek
Časové období	Počet kusů celkem	–
Stav objednávky	Pokrytí (%)	–
•	Logika: Systém sečte vypočtenou spotřebu (dle vzorce v sekci 4.2) pro konkrétní Pantone barvu ze všech aktivních a plánovaných objednávek ve zvoleném období.
9. Technická omezení a parametry
•	Formáty souborů: PDF (tisková data), JPG/PNG (náhledy).
•	Datový limit: 50 MB na PDF soubor.
•	UI Constraints: Všechna data prezentovat v Markdown tabulkách nebo seznamech. Zakázáno používat externí grafické diagramy.
•	Integrace: Systém připraven na export dat do formátu XML pro návazné systémy (Cicero/Pey).

--------------------------------------------------------------------------------

# Implementační plán: IML – nová specifikace (iml_newsec.md)

> Referenční specifikace: `docs/iml_newsec.md`  
> Tento dokument je závazný návod pro implementaci. Každá fáze je samostatně nasaditelná a má vlastní akceptační kritéria.  
> **Jazyk UI a textů: čeština.** Backend komentáře minimálně, jen tam, kde není intent zřejmý z kódu.

---

## 0. Výchozí stav repozitáře (nemodifikovat mimo kontext fáze)

Framework: **Next.js App Router + TypeScript + Prisma (MySQL) + NextAuth**.

### 0.1 Existující IML struktura

Databáze (`prisma/schema.prisma`):
- `iml_customers` – plochý model, adresy jsou Text.
- `iml_products` – pole dle tabulky níže + `image_data`, `pdf_data` jako `LongBlob` přímo v řádku.
- `iml_orders` + `iml_order_items`.
- `iml_custom_fields` – dynamická pole pro `products` / `orders` (`entity`, `field_key`, `label`, `field_type`, `sort_order`).

API (`app/api/iml/**`):
- `customers`, `customers/[id]`, `customers/import`, `customers/export`
- `products`, `products/[id]`, `products/[id]/image`, `products/[id]/pdf`, `products/import`, `products/export`
- `orders`, `orders/[id]`, `orders/import`, `orders/export`
- `custom-fields`, `custom-fields/[id]`

UI (`app/(dashboard)/iml/**`):
- `page.tsx` – dashboard
- `customers/{page, add, import, [id], [id]/edit}`
- `products/{page, add, import, [id], [id]/edit}` + komponenty `_components/ProductFilesUpload*.tsx`
- `orders/{page, add, import, [id], [id]/edit}` + `ImlOrdersClient.tsx`
- `settings/page.tsx` (vlastní pole)
- `imports/page.tsx` (rozcestník)
- Sdílená komponenta `_components/CustomFieldsFormSection.tsx`

Utility:
- `lib/iml-audit.ts` → `logImlAudit({ userId, action, tableName, recordId, oldValues?, newValues? })`
- `lib/iml-export.ts`
- `lib/auth-utils.ts` → `hasModuleAccess(userId, "iml", "read"|"write")`
- `lib/db.ts` → Prisma klient + `PrismaTransactionClient` typ

### 0.2 Konvence (závazné pro všechny fáze)

1. **Auth gate** v každém route handleru:
   ```ts
   const session = await auth();
   if (!session?.user?.id) return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
   const userId = parseInt(session.user.id, 10);
   if (!(await hasModuleAccess(userId, "iml", "read"|"write"))) 
     return NextResponse.json({ error: "Nemáte oprávnění k modulu IML" }, { status: 403 });