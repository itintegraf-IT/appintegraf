# Dokumentace aplikace IG52 – Reverzní inženýrství

## 1. Přehled systému

Aplikace **IG52** je systém pro správu **termálních tiskáren** a **loterních/loterijních produktů**. Pracuje s více typy tiskových zařízení (CD_POP, CD_Vnitro, Validator, DPB_AVJ, IGT Sazka) a ukládá konfiguraci do binárních souborů s definovanou paměťovou mapou.

**Kontext:** Systém pravděpodobně slouží pro provoz sázkových/loterních terminálů (např. Sazka) s integrovanými tiskárnami pro výstup tiketů, stíracích losů nebo validátorů.

---

## 2. Struktura projektu

```
Aplikace_IG52/
├── FixSettings.xml      # Pevná konfigurace tiskáren (parametry zařízení)
├── VarSettings.dir      # Mapování proměnných → offset a velikost v binárním souboru
├── VarSettings.bak      # Záloha VarSettings.dir
└── Zamestnanci/
    └── Zamestnanci.txt  # Seznam zaměstnanců/operátorů
```

---

## 3. FixSettings.xml – Konfigurace tiskáren

### 3.1 Struktura XML

```xml
<parametry>
  <[TYP_TISKÁRNY] Kod="..." VzdalCisl="..." CisNaRoli="..." PocCislic="..." PocetHlav="...">_</[TYP_TISKÁRNY]>
</parametry>
```

### 3.2 Atributy parametrů

| Atribut | Význam | Popis |
|---------|--------|-------|
| **Kod** | Kód zařízení | Identifikátor modelu tiskárny (Hm.0.735.2.xxxx) nebo popisný název |
| **VzdalCisl** | Vzdálenost čísla | Pravděpodobně rozteč mezi čísly na roli (mm nebo jednotky) – u všech hodnota **4** |
| **CisNaRoli** | Čísla na roli | Počet tiskových položek na jedné roli papíru (nebo "x" = proměnné) |
| **PocCislic** | Počet číslic | Délka sériového čísla / identifikátoru (5–7 číslic) |
| **PocetHlav** | Počet hlav | Počet tiskových hlav tiskárny (6 nebo 8) |

### 3.3 Typy tiskáren a jejich parametry

| Typ | Kód | Čísla na roli | Počet číslic | Počet hlav |
|-----|-----|---------------|--------------|------------|
| **CD_POP** | Hm.0.735.2.4116 | x (proměnné) | 6 | 6 |
| **CD_POP_NEXGO** | Hm.0.735.2.4125 | 160 | 6 | 8 |
| **CD_Vnitro** | Hm.0.735.2.4113 | 1000 | 7 | 6 |
| **CD_Validator** | Hm.0.735.2.4124 | 500 | 7 | 6 |
| **DPB_AVJ** | Kotouce AVJ | 3600 | 5 | 6 |
| **IGT_Sazka** | Sazka | 3283 | 6 | 6 |

### 3.4 Interpretace parametrů

- **CD_POP / CD_POP_NEXGO** – pravděpodobně „CD“ = cenový doklad / tiket, „POP“ = point of sale
- **CD_Vnitro** – vnitřní tisk (interní dokumenty)
- **CD_Validator** – validátor (ověření tiketu)
- **DPB_AVJ** – kotouče AVJ (specifický typ produktu)
- **IGT_Sazka** – integrace s loterním systémem Sazka

---

## 4. VarSettings.dir – Paměťová mapa

Soubor definuje **offset** a **velikost** (v bajtech) pro každou proměnnou v binárním datovém souboru. Formát řádku:

```
'NÁZEV_PROMĚNNÉ', (OFFSET, VELIKOST)
```

### 4.1 Hlavní proměnné (konfigurace tiskáren)

| Proměnná | Offset | Velikost (B) | Popis |
|----------|--------|--------------|-------|
| CD_POP | 0 | 132 | Konfigurace CD_POP |
| CD_POP_NEXGO | 512 | 159 | Konfigurace CD_POP NEXGO |
| CD_Vnitro | 1024 | 141 | Konfigurace CD vnitřní |
| CD_Validator | 1536 | 139 | Konfigurace validátoru |
| DPB_AVJ | 2048 | 137 | Konfigurace kotoučů AVJ |
| IGT_Sazka | 2560 | 212 | Konfigurace IGT Sazka |
| ADRESA | 3072 | 25 | Adresa (provozovny/terminálu?) |

### 4.2 Paleta (barevné nastavení / typy)

| Proměnná | Offset | Velikost (B) | Popis |
|----------|--------|--------------|-------|
| PALETA/CD_POP | 3584 | 32 | Paleta pro CD_POP |
| PALETA/CD_POP_NEXGO | 4096 | 5 | Paleta pro CD_POP NEXGO |
| PALETA/CD_Vnitro | 4608 | 32 | Paleta pro CD vnitřní |
| PALETA/CD_Validator | 5120 | 20 | Paleta pro validátor |
| PALETA/DPB_AVJ | 5632 | 20 | Paleta pro DPB_AVJ |
| PALETA/IGT_Sazka | 6144 | 5 | Paleta pro IGT Sazka |

### 4.3 Zákaznické nastavení

| Proměnná | Offset | Velikost (B) | Popis |
|----------|--------|--------------|-------|
| C_ZAK/IGT_Sazka | 6656 | 17 | Zákaznické nastavení pro IGT Sazka |

### 4.4 Výpočet celkové velikosti datového souboru

```
Poslední offset + velikost = 6656 + 17 = 6673 bajtů
```

Minimální velikost binárního souboru pro ukládání všech proměnných: **6673 bajtů**.

### 4.5 Alokace paměti

- Offsety jsou zarovnány na **512 bajtů** (0, 512, 1024, 1536, …)
- Mezi bloky zůstává volné místo (např. mezi CD_POP a CD_POP_NEXGO: 512 − 132 = 380 bajtů rezervy)

---

## 5. Zamestnanci.txt – Seznam zaměstnanců

### 5.1 Formát

Jeden zaměstnanec na řádek ve formátu:
```
[Jméno] [Příjmení]
```

### 5.2 Speciální znaky

- Řádek `*` – pravděpodobně oddělovač nebo konec aktivního seznamu
- Řádek `žščřěžýě` – testovací řádek (diakritika)

### 5.3 Příklad obsahu

```
Pepa umyvadlo
Franta Vohnout
Josef Novak
Dežo Horvát
žščřěžýě
*
```

**Použití:** Seznam operátorů/prodejců, kteří mohou pracovat s terminálem nebo tiskárnami.

---

## 6. Logika výpočtů a odvozené vzorce

### 6.1 Výpočet pozice proměnné v binárním souboru

Pro proměnnou s názvem `X`:
```
byte_offset = offset z VarSettings.dir
byte_size = velikost z VarSettings.dir

data = soubor[byte_offset : byte_offset + byte_size]
```

### 6.2 Odhad struktury podle velikostí

| Velikost | Možný obsah |
|----------|-------------|
| 5 B | Krátký identifikátor nebo příznak |
| 17 B | Krátký text (adresa, kód) |
| 20 B | Nastavení palety |
| 25 B | Adresa (řetězec) |
| 32 B | Paleta barev (např. 8× RGBA nebo podobně) |
| 132–212 B | Komplexní konfigurace (parametry, sériová čísla, stav) |

### 6.3 Parametry tiskárny (z FixSettings.xml)

Pro každý typ tiskárny platí:
- **VzdalCisl** = 4 (konstanta pro všechny)
- **CisNaRoli** – určuje, kolik tiskových položek je na roli (pro výpočet zbývající kapacity)
- **PocCislic** – formát sériového čísla (např. 6 číslic = 000001–999999)

---

## 7. Předpokládaný tok dat

```
1. Načtení FixSettings.xml → typy tiskáren a jejich parametry
2. Načtení VarSettings.dir → mapa offsetů pro binární soubor
3. Čtení/zápis binárního souboru (VarSettings.dat?) podle offsetů
4. Načtení Zamestnanci.txt → seznam oprávněných uživatelů
5. Při tisku: kontrola typu tiskárny → aplikace parametrů (CisNaRoli, PocCislic, …)
```

---

## 8. Chybějící komponenty (odvozeno z analýzy)

- **Binární datový soubor** – pravděpodobně `VarSettings.dat` nebo podobný (není v projektu)
- **Spustitelná aplikace** – .exe nebo skript (není v projektu)
- **Zdrojový kód** – není k dispozici

---

## 9. Shrnutí

| Komponenta | Účel |
|------------|------|
| **FixSettings.xml** | Definice typů tiskáren a jejich technických parametrů |
| **VarSettings.dir** | Mapování proměnných na offset a velikost v binárním souboru |
| **Zamestnanci.txt** | Seznam zaměstnanců/operátorů systému |

Aplikace IG52 je konfigurační a datový modul pro systém termálních tiskáren používaný v prostředí loterních/sázkových terminálů (např. Sazka).
