# Kalendář v INTEGRAF – návod pro uživatele

Technická dokumentace modulu je v [MODUL_KALENDAR.md](./MODUL_KALENDAR.md). Tento dokument popisuje použití z pohledu běžného uživatele.

---

## K čemu slouží

Kalendář slouží k evidenci událostí a termínů: schůzky, dovolené, lékaře, služební cesty a další typy absencí či událostí. U některých typů běží **dvoufázové schvalování** (nejprve zástup, poté vedoucí oddělení). Kalendář můžete také **exportovat** do souboru `.ics` a naimportovat ho například do Outlooku nebo Google Kalendáře.

**Přístup:** v aplikaci otevřete sekci **Kalendář** (cesta `/calendar`).

---

## Zobrazení událostí

- **Týden** – mřížka **pondělí–neděle**, hodiny **0–23** a řádek **Celý den** pro celodenní události.
- **Měsíc** – přehled měsíce v mřížce (cca 6 týdnů); dny mimo měsíc jsou znevýrazněné, **dnešní den** je zvýrazněný.
- **Seznam osobní** – tabulkový přehled **vašich** událostí (včetně těch, kde jste zástupem, a těch čekajících na schválení vedoucím) na **14 dní dopředu**.
- **Seznam globální** – stejný formát, ale **všechny** události v systému (v rozsahu seznamu).

U měsíčního pohledu se na jeden den vejde zobrazení **max. tří událostí**; u většího počtu použijte týden nebo detail.

---

## Globální vs. osobní kalendář

(Záložky se týkají hlavně pohledů **Týden** a **Měsíc**; u seznamů je rozsah daný typem seznamu.)

| | **Globální kalendář** | **Osobní kalendář** |
|---|------------------------|----------------------|
| **Co uvidíte** | Všechny události | Vaše události, události kde jste **zástupce**, události čekající na **schválení vedoucím** |

---

## Navigace v čase

### Týdenní pohled

- **«** – o týden zpět
- **<** – o jeden den zpět
- **>** – o jeden den vpřed
- **»** – o týden vpřed
- **Nyní** – návrat na aktuální týden

### Měsíční pohled

- **<** – předchozí měsíc
- **>** – další měsíc
- **Nyní** – aktuální měsíc

### Seznamy (14 dní)

- Tlačítka **Předchozí 14 dní** / **Další 14 dní** posouvají zobrazené období.

---

## Vyhledávání

Do vyhledávání zadejte text z **názvu, popisu nebo místa**, případně jméno související s událostí (**tvůrce, zástup, účastníci**).

- Výsledky můžete zobrazit jako **seznam** (tabulka: datum, čas, název, lidé, místo) nebo přepnout na **zobrazení v kalendáři** (mřížka).
- U výsledků je k dispozici odkaz na **detail události** a tlačítko **Zobrazit v kalendáři**, které otevře kalendář s odpovídajícím rozsahem/filtrem.

---

## Vytvoření nové události

1. **Kliknutím do mřížky** (týden) – otevře se formulář s **předvyplněným datem a časem** podle buňky.
2. **Kliknutím na den v měsíčním pohledu** – typicky pro **novou celodenní** událost.
3. Stránka **Přidat událost** – klasické zadání z menu nebo odkazu.

Vyplňte název, časové rozpětí, typ události, případně místo, barvu, oddělení, účastníky podle toho, co formulář nabízí.

---

## Typy událostí

Mezi typy patří například: **Dovolená**, **Osobní**, **Schůzka mimo firmu**, **Služební cesta**, **Lékař**, **Nemoc**, **Jiné** (výchozí může být „Jiné“).

U typů **Dovolená** a **Osobní** je pole **Zástup** **povinné** – bez zvoleného zástupce schvalovací proces neproběhne správně.

---

## Schvalování (Dovolená / Osobní)

1. **Čeká na zástupce** – zástup dostane upozornění a může událost **schválit** nebo **zamítnout** (u zamítnutí lze zadat důvod).
2. **Po schválení zástupem** – pokud má vaše oddělení **vedoucího**, událost čeká na **vedoucího oddělení** (druhá fáze). Pokud vedoucí **není** nastaven, může být událost po zástupovi rovnou **definitivně schválena**.
3. **Schváleno** – finální souhlas (typicky od vedoucího).
4. **Zamítnuto** – zástupcem nebo vedoucím.

### Kde vás to upozorní

- **Dashboard** – sekce **Události ke schválení** a **Notifikace**.
- V záhlaví aplikace – **zvoneček** (nepřečtené notifikace).

Na **detailu události** vidíte stav a případná tlačítka **Schválit** / **Zamítnout**, pokud jste oprávněnou osobou (zástup v první fázi, vedoucí ve druhé).

---

## Stavy v kalendáři (týdenní pohled)

Události mohou mít štítky podle stavu schválení, například:

- čeká na schválení (zástup),
- čeká na vedoucího,
- schváleno.

(Přesné barvy a texty odpovídají obrazovce.)

---

## Úprava a mazání

- **Úprava** – přes stránku detailu a odkaz na úpravu, pokud k tomu máte právo.
- **Smazání** – tlačítko **Smazat** na detailu je dostupné **jen tvůrci** události; před smazáním je **potvrzení**. U již schválené události mohou být schvalovatelé informováni o zrušení.

---

## Přesun události (přetahování)

V **týdenním** pohledu může **tvůrce** vlastní události **přetahovat** na jiný den nebo čas (včetně řádku **Celý den**). Po přetažení se obvykle zobrazí **potvrzení** s novým datem a časem.

**Důležité:** u typů **Dovolená** a **Osobní** se po přesunu **schválení resetuje** (událost znovu čeká u zástupce) a zástupce může dostat novou notifikaci.

---

## Státní svátky

V týdenním i měsíčním pohledu jsou zobrazeny **české státní svátky** (včetně pohyblivých svátků jako Velký pátek a Velikonoční pondělí). Sloupce/dny se svátkem jsou ve mřížce zvýrazněné; svátky jsou označeny štítky.

---

## Export do Outlooku / telefonu (.ics)

Kalendář lze **exportovat** jako soubor **iCalendar (.ics)** a importovat do Outlooku, Google Kalendáře, Apple Kalendáře atd. Rozsah exportu odpovídá nastavení a oprávněním (globální export může být vyhrazen pro administrátory).

---

## Praktické tipy

- Chcete-li vidět jen „svůj“ provoz, použijte **Osobní kalendář** a případně **Seznam osobní**.
- Potřebujete najít konkrétní schůzku nebo člověka, použijte **vyhledávání** a případně **Zobrazit v kalendáři**.
- Plánujete dovolenou, nezapomeňte včas zvolit **zástup** a sledovat notifikace až do **definitivního** schválení vedoucím.
