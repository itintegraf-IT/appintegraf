# Mini manuál hotových modulů

Tento dokument shrnuje hotové moduly systému INTEGRAF v jednotném formátu pro rychlé zaškolení uživatelů.

---

## 1) Kalendář

**Cesta:** `/calendar`  
**Účel:** Plánování událostí, absencí a schvalování vybraných typů událostí.

### Co modul umí
- Týdenní, měsíční a seznamové zobrazení.
- Osobní a globální pohled.
- Vyhledávání podle textu i osob.
- Vytvoření, úprava, smazání a přesun události (drag and drop).
- Dvoufázové schvalování u typů **Dovolená** a **Osobní** (zástup -> vedoucí).
- Export kalendáře do `.ics`.

### Rychlý návod
1. Otevřete `Kalendář` a zvolte pohled (`Týden`, `Měsíc`, `Seznam`).
2. Přepněte `Globální` nebo `Osobní` kalendář.
3. Novou událost vytvořte kliknutím do mřížky nebo přes přidání události.
4. U typu `Dovolená`/`Osobní` vždy vyberte zástup.
5. Sledujte stavy schválení v dashboardu a notifikacích.
6. Pro napojení do Outlook/Google použijte export `.ics`.

### Praktické tipy
- Seznamové pohledy ukazují období po 14 dnech a jsou vhodné pro rychlou kontrolu.
- Po přesunu dovolené/osobní události se schvalování obnoví od začátku.

---

## 2) Kontakty

**Cesta:** `/contacts`  
**Účel:** Centrální evidence zaměstnaneckých kontaktů.

### Co modul umí
- Přehled kontaktů v tabulce i kartách.
- Filtrování podle oddělení a vyhledávání (jméno, e-mail, telefon).
- Detail kontaktu a správa kontaktů podle oprávnění.
- Export a import CSV.

### Rychlý návod
1. Otevřete `Kontakty`.
2. Vyhledejte osobu podle jména/e-mailu/telefonu.
3. Použijte filtr oddělení pro zpřesnění.
4. Přepněte `Seznam` nebo `Karty` podle potřeby.
5. Exportujte data přes `Export CSV`.
6. S oprávněním zápisu použijte `Import CSV` nebo `Přidat kontakt`.

### Praktické tipy
- Pro hromadné změny používejte import.
- Po importu ověřte klíčové kontakty v detailu.

---

## 3) Majetek

**Cesta:** `/equipment`  
**Účel:** Evidence vybavení, jeho stavů a přiřazení zaměstnancům.

### Co modul umí
- Přehled majetku (moje vybavení / vše podle oprávnění).
- Správa přiřazení majetku.
- Workflow požadavků na techniku.
- Tisk protokolů předání a vrácení.

### Rychlý návod
1. Otevřete `Majetek` a pracujte v záložce `Vybavení`.
2. Podle oprávnění přepněte pohled na své nebo veškeré vybavení.
3. V akcích položky řešte detail, úpravy, přiřazení a status.
4. V záložce `Požadavky` zpracujte požadavky na techniku.
5. V `Přiřazení` kontrolujte aktivní zápůjčky.
6. Tiskněte `Předání` a `Vrácení` protokoly.

### Praktické tipy
- U položek bez data nákupu systém dopočítává stáří od data zápisu.
- Při vrácení majetku vždy aktualizujte stav i dokumentaci.

---

## 4) Úkoly

**Cesta:** `/ukoly`  
**Účel:** Zadávání, sledování a vyhodnocování pracovních úkolů.

### Co modul umí
- Zakládání úkolů s termínem, prioritou, přílohou a příjemci.
- Přiřazení uživateli i oddělením.
- Stavy úkolu (`open`, `in_progress`, `done`, `cancelled`).
- Notifikace a e-mail při přidělení a změně termínu.
- Archiv, statistiky a export archivu (CSV/XLSX).

### Rychlý návod
1. Otevřete `Úkoly` a založte nový úkol.
2. Vyplňte alespoň jednoho příjemce (uživatel nebo oddělení).
3. Nastavte termín splnění a případně urgentnost.
4. Po převzetí potvrďte rozpracování.
5. Po dokončení potvrďte splnění (úkol se přesune do archivu).
6. Pro přehledy využijte `Statistiky` a export archivu.

### Praktické tipy
- Terminové změny dělejte přímo v detailu, aby se odeslaly notifikace.
- V kalendáři se zobrazují jen aktivní úkoly (ne hotové/zrušené).

---

## 5) Personalistika

**Cesta:** `/personalistika`  
**Účel:** Správa dotazníků uchazečů, pracovních pozic a evidence brigádníků.

### Co modul umí
- Evidence uchazečů a jejich stavů.
- Detail uchazeče včetně rozšířených dat dotazníku.
- Správa příloh (napr. CV, PDF dokumenty).
- Správa pracovních pozic (přidání, aktivace/deaktivace, smazání).
- Evidence brigádníků (jméno, telefon, e-mail, stav: Student / Důchodce / Nezaměstnaný / Zaměstnaný / OSVČ / Mateřská-rodičovská / Jiné, poznámka).

### Rychlý návod
1. Otevřete `Personalistika`.
2. V záložce `Dotazníky` filtrujte a vyberte uchazeče.
3. V detailu upravte údaje, stav a interní poznámky.
4. Nahrajte nebo smažte přílohy podle potřeby.
5. Uložte změny.
6. V záložce `Pracovní pozice` spravujte seznam pozic.
7. V záložce `Brigádníci` přidávejte krátkodobé pracovníky tlačítkem `Přidat brigádníka`, vyhledávejte je podle jména, telefonu nebo e-mailu a upravujte/mazejte přímo v tabulce.

### Praktické tipy
- Pro náborovou schůzku nastavte status na `Pozván`.
- U přijatých kandidátů doplňte poznámky, aby byly dostupné pro onboarding.
- U brigádníků udržujte správně stav (např. `Student`, `Důchodce`, `OSVČ`) — pomáhá to rychle orientaci v evidenci a později i pro podklady mzdové účetní.

---

## Doporučený postup zaškolení (30-45 minut)

1. **Kalendář (10 min):** založení události + schvalování.
2. **Úkoly (10 min):** vytvoření úkolu, změna stavu, archiv.
3. **Kontakty (5 min):** vyhledání, filtr, export.
4. **Majetek (10 min):** práce se seznamem a přiřazením.
5. **Personalistika (5-10 min):** práce s dotazníkem a pozicemi.

Výsledek školení: uživatel se orientuje v modulech, umí zadat běžné operace a ví, kde hledat notifikace a výstupy.
