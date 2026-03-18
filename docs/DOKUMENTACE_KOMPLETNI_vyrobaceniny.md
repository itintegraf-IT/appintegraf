# Kompletní dokumentace aplikace IG52 – pro migraci do Next.js

## 1. Přehled systému

**IG52** je desktopová aplikace (Python 3.9, wxPython) pro správu výroby a balení **loterních produktů** (jízdenky, stírací losy, kotouče) pro Sazka a ČD. Systém zahrnuje:

- **Generování** – vytváření datových souborů pro tiskárny (CSV/TXT)
- **Kontrola** – sledování balení, krabic, palet a číslování
- **Protokoly** – tisk balných listů, štítků, PDF

---

## 2. Architektura dat

### 2.1 FixSettings.xml – pevné parametry tiskáren

```xml
<parametry>
  <[JOB] Kod="..." VzdalCisl="4" CisNaRoli="..." PocCislic="..." PocetHlav="...">_</[JOB]>
</parametry>
```

**Mapování atributů na indexy v kódu:**
- `SetXML[JOB][0]` = KROK (VzdalCisl)
- `SetXML[JOB][1]` = PocetCnaRoli (CisNaRoli)
- `SetXML[JOB][2]` = CiselNaRoli (alias)
- `SetXML[JOB][3]` = CISLIC (PocCislic)

| JOB | CisNaRoli | PocCislic | PocetHlav |
|-----|------------|-----------|-----------|
| CD_POP | x (variabilní) | 6 | 6 |
| CD_POP_NEXGO | 160 | 6 | 8 |
| CD_Vnitro | 1000 | 7 | 6 |
| CD_Validator | 500 | 7 | 6 |
| DPB_AVJ | 3600 | 5 | 6 |
| IGT_Sazka | 3283 | 6 | 6 |

### 2.2 VarSettings – variabilní data (Python shelve + pickle)

**VarSettings.dat** – binární soubor, každý blok je **samostatný Python pickle**.

**Struktura proměnné pro JOB (např. CD_POP):**
```javascript
[
  "Volny",           // [0] Stav (Volny/Zauzleny)
  ["XB","XC",...],   // [1] SerieL - identifikátory hlav/sérií
  "180",             // [2] PocetCnaRoli (pro CD_POP variabilní)
  "20",              // [3] KsVKr - ks v krabici
  "0",               // [4] PrvniRole - první číslo role
  "997920",          // [5] PrvniJizd - první číslo jízdenky
  "6",               // [6] PROD - počet produkcí (hlav)
  "0",               // [7] Skip (pouze DPB_AVJ)
  []                 // [8] PredcisliL (pouze IGT_Sazka)
]
```

**IGT_Sazka** má navíc `PredcisliL`, např. `['000','010','020','030','040','050']`.

**ADRESA** – string, např. `D:\Sazka\A17144`

**PALETA/[JOB]** – pole počtů krabic na paletě nebo jedno číslo

**C_ZAK/IGT_Sazka** – číslo zakázky (7 znaků), např. `ABC1234`

---

## 3. VÝPOČTY A VZORCE

### 3.1 Počet výhozů (všude stejný)

```javascript
PocetVyhozu = Math.ceil(PocetKS / PROD)
// Zaokrouhlení nahoru: pokud (PocetVyhozu - Math.floor(PocetVyhozu)) > 0, pak +1
```

### 3.2 CD_POP – jízdní doklady POP

**PrvniRole:**
```javascript
PrvniRole = Math.floor(PrvniJizd / PocetCnaRoli)
```

**Číslo 1. jízdenky na výhoz:**
```javascript
Cislo0Jizd = PrvniJizd + (vyhoz - 1) * PocetCnaRoli
```

**Formát čísla jízdenky:**
```javascript
c3 = String(Cislo0Jizd + c1).padStart(CISLIC + 2, '0')
// CISLIC z FixSettings (PocCislic)
```

**Řádek dat:**
```
[Serie] [c3];  (pro každou hlavu v SerieL)
```

### 3.3 CD_POP_NEXGO

Podobné CD_POP, ale **PocetCnaRoli je fixní** (160). Číslování přes hlavy:
```javascript
// Pro hlavu p: číslo = c3 + (d + p) * PocetCnaRoli
// d = vyhoz * (p)  -- pozor, p je z předchozí iterace
Row2 = SerieL[p] + " " + String(c3 + (d + p) * PocetCnaRoli).padStart(CISLIC + 2, '0')
```

### 3.4 CD_Vnitro, CD_Validator

**PocetVyhozu:**
```javascript
PocetVyhozu = Math.ceil(PocetKS / PROD)
```

**CisloRole (číslo role):**
```javascript
CisloRole = Cislovani === "VYP" ? 0 : PrvniJizd + vyhoz - 1
```

**Zaváděcí část:** 6 řádků „NEPRODEJNE“ (Validator) nebo 6 (Vnitro)
**Hlavní část:** PocetCnaRoli řádků, formát:
```javascript
CisloRoleF = String(CisloRole).padStart(3, '0')
CisloJizdF = String(CisloJizd).padStart(4, '0')
Cislo = CisloRoleF + "  " + CisloJizdF  // např. "001  0001"
```

**Koncová část:** 4 řádky „NEPRODEJNE“

### 3.5 DPB_AVJ – kotouče

**Skip kontrola:**
```javascript
SkipPocitany = PocetKS / PROD
// Varování pokud: 0.9 < |SkipPocitany/Skip| < 1.1 není splněno
```

**Zaváděcí pás:** 14 čísel, formát:
```javascript
b3 = String((p * Skip + (PrvniRole - 1) + vyhoz)).padStart(4, '0')
Row1 = "NEPREDAJNE " + b3 + ";"
```

**Hlavní část – modulo výpočet:**
```javascript
mod1 = (String(b3) + String(c3)).split('').reverse().join('')  // reversed
mod2 = parseInt(b3) + parseInt(c3)
mod3 = Math.floor(parseInt(mod1) / mod2)
modulo = String(mod3).slice(-1)  // poslední cifra
```

**Výběh:** 300 řádků „ZACATEK“ na konec

### 3.6 IGT_Sazka – stírací losy

**Vstup:** PocetPredcisli (počet předčíslí, obvykle počet rolí)

**Podmínka:** `(A - B) === 0` kde `A = floor(PocetPredcisli/PROD)`, `B = PocetPredcisli/PROD`

**Cyklus:**
```javascript
Cykl6 = Math.max(1, Math.floor(A / 10))
for (s = 0; s < Cykl6; s++) {
  for (r = 0; r < 10; r++) {
    for (PoradCislo = 1; PoradCislo < 999999; PoradCislo++) {
      for (p = 0; p < PocHlav; p++) {
        Predcisli2 = Predcisli3 + parseInt(PredcisliL[p]) + r
        Predcisli2F = String(Predcisli2).padStart(3, '0')
        PoradCisloF = String(PoradCislo).padStart(6, '0')
        Row2 += SerieL[p] + "_" + Predcisli2F + "_" + PoradCisloF + "|"
      }
    }
    Predcisli3 = Predcisli2 + 1
  }
}
```

### 3.7 Deleni3 – formátování čísel (mezery po 3 cifrách)

```javascript
function Deleni3(line) {
  let i = 1, line3 = ''
  for (const a of [...line].reverse()) {
    if (i === 3) { line3 += a + ' '; i = 0 }
    else { line3 += a }
    i++
  }
  return line3.split('').reverse().join('')
}
// Příklad: "1234567" -> "1 234 567"
```

### 3.8 Rozpracované krabice – určení prvního nového čísla

**CD_Vnitro, CD_Validator, CD_POP:**
```javascript
if (CisloJizdHOT === 0 && CisloJizdOTV_min === 0) CisloJizd = CisloJizd1
else if (CisloJizdHOT === 0 && CisloJizdOTV_min > 0) CisloJizd = CisloJizdOTV_min
else if (CisloJizdHOT > 0 && CisloJizdOTV_min === 0) CisloJizd = CisloJizdHOT
else if (CisloJizdHOT < CisloJizdOTV_min) CisloJizd = CisloJizdHOT
else CisloJizd = CisloJizdOTV_min
// PrvniJizd = CisloJizd - 1
```

**DPB_AVJ:**
```javascript
if (CisloJizdHOT === 0 && CisloJizdOTV_PROD === 0) CisloJizd = CisloJizd1
else if (CisloJizdHOT === 0 && CisloJizdOTV_PROD > 0) CisloJizd = CisloJizdOTV_PROD
else if (CisloJizdHOT > 0 && CisloJizdOTV_PROD === 0) CisloJizd = BigestNo
else if (CisloJizdHOT < CisloJizdOTV_PROD) CisloJizd = BigestNo
else CisloJizd = CisloJizdOTV_PROD
```

### 3.9 DPB_AVJ – první číslo pro produkci k

```javascript
PrvniJizd2 = CisloJizd - Skip * ((PROD - 1) - k) - 1
```

### 3.10 Posun čísel (tlačítka <, <<, >, >>)

**CD_POP, CD_Vnitro, CD_Validator:**
- Zpět: `CisloRole2 = CisloRole + Skip` (Skip = CiselNaRoli)
- Vpřed: `CisloRole2 = CisloRole - Skip`
- Pro 10 kroků: `Skip * 10`

**DPB_AVJ:**
- Skip = 1 (ne CiselNaRoli)
- Pro NEXGO: `Skip = CiselNaRoli * PROD`

**IGT_Sazka:** Skip = ±1, ±10, ±100, ±1000

---

## 4. Formát výstupních souborů

### 4.1 TXT řádek (balení)

```
Ks|Serie|KoncCisloRole|CisloRoleF
```
- Ks: počet zbývajících ks do plné krabice (2 cifry)
- Serie: identifikátor série
- KoncCisloRole: první číslo v krabici (formátované)
- CisloRoleF: poslední číslo v krabici

**Metadata na konci TXT:**
```
JOB: [JOB]
CISLO_KRABICE: [cislo]
PRODUKCE: [k+1]
C_KRAB_NA_PALETE: [cislo]
MNOZSTVI: [KsVKr] ks
BALIL: [jmeno]
CAS: [datum]
```

**IGT_Sazka** používá navíc:
```
SERIE: [SerieL[k]]
CISLO_PALETY: [CisloPalety]
```

### 4.2 CSV balný list

Sloupce: Poř.č., Serie, Od č., Do č.

### 4.3 Sestavy pro IGT (TextakSazka)

Formát TXT:
```
ShipmentDate	CisloZakazky	CisloPalety	CisloKrabice	CisloRolky	Serie	PocatekCislovani	KonecCislovani
```

---

## 5. Paměťová mapa VarSettings.dat

| Proměnná | Offset | Velikost |
|----------|--------|----------|
| CD_POP | 0 | 132 |
| CD_POP_NEXGO | 512 | 159 |
| CD_Vnitro | 1024 | 141 |
| CD_Validator | 1536 | 139 |
| DPB_AVJ | 2048 | 137 |
| IGT_Sazka | 2560 | 212 |
| ADRESA | 3072 | 25 |
| PALETA/CD_POP | 3584 | 32 |
| PALETA/CD_POP_NEXGO | 4096 | 5 |
| PALETA/CD_Vnitro | 4608 | 32 |
| PALETA/CD_Validator | 5120 | 20 |
| PALETA/DPB_AVJ | 5632 | 20 |
| PALETA/IGT_Sazka | 6144 | 5 |
| C_ZAK/IGT_Sazka | 6656 | 17 |

**Poznámka:** Data jsou v Python pickle. Pro Next.js doporučeno převést na JSON nebo databázi.

---

## 6. Zaměstnanci

Soubor `Zamestnanci/Zamestnanci.txt` – jeden řádek = jeden zaměstnanec (jméno příjmení). Řádek `*` může sloužit jako oddělovač.

---

## 7. Doporučená struktura pro Next.js

### 7.1 API endpointy

```
GET  /api/jobs              – seznam JOB typů
GET  /api/jobs/[job]/config – konfigurace JOB (Fix + Var)
PUT  /api/jobs/[job]/config – uložení Var
GET  /api/address           – ADRESA
PUT  /api/address           – uložení ADRESA
GET  /api/employees         – Zamestnanci
POST /api/generate/[job]    – generování dat (Create*)
POST /api/control/[job]     – kontrola/výhoz (ButtonOK)
GET  /api/boxes/[job]       – rozpracované krabice
POST /api/protocol/[job]    – generování protokolů PDF
```

### 7.2 Datový model (JSON/DB)

```typescript
interface JobConfig {
  job: string
  stav: string
  serie: string[]
  pocetCnaRoli: string | number
  ksVKr: number
  prvniRole: number
  prvniJizd: number
  prod: number
  skip?: number
  predcisli?: string[]
}

interface FixConfig {
  [job: string]: {
    kod: string
    cisNaRoli: number | 'x'
    pocCislic: number
    pocetHlav: number
  }
}
```

### 7.3 Klíčové funkce k implementaci

1. **CteniXML** – parsování FixSettings.xml
2. **ShelveToDict / DictToShelve** – čtení/zápis VarSettings (nahradit DB)
3. **CreateVnitro, CreateValidator, CreatePOP, CreateNEXGO, CreateDPB_AVJ, CreateIGT_Sazka** – generování
4. **Deleni3** – formátování čísel
5. **RozprcaneKrabice** – načtení stavu krabic
6. **ButtonOK** logika – výhoz, zápis TXT, přejmenování při plné krabici
7. **Ulozeni_PDF** – generování PDF protokolů (FPDF → pdf-lib nebo server-side)
8. **Printer.EPSON_FX** – tisk na jehličkovou tiskárnu (Windows-specific, v Next.js řešit jinak)

### 7.4 Závislosti k nahrazení

| Původní | Next.js alternativa |
|---------|---------------------|
| wxPython | React UI |
| shelve | JSON file / SQLite / PostgreSQL |
| FPDF | pdf-lib, @react-pdf/renderer, nebo server PDF |
| win32print | Cloud print API / backend tisková služba |
| webbrowser.open | window.open / download |

---

## 8. Struktura složek (ADRESA)

```
[ADRESA]/
├── TISK/
│   ├── CD_POP/
│   ├── CD_POP_NEXGO/
│   ├── CD_Vnitro/
│   ├── CD_Validator/
│   ├── DPB_AVJ/
│   └── IGT_Sazka/
└── REZANI/
    └── [JOB]/
        ├── 1.txt, 2.txt, ... (rozpracované krabice)
        ├── TXT/ (hotové krabice)
        ├── PDF/ (protokoly)
        ├── CSV/ (sestavy)
        └── Settings.xml (poslední stav)
```

**IGT_Sazka** navíc:
```
Sestavy_IGT/
├── INKJETY/ (soubory pro tisk štítků)
├── TXT/
├── PALETY/
└── SESTAVY/
```

---

## 9. Shrnutí výpočtů pro rychlý přehled

| Operace | Vzorec |
|---------|--------|
| PocetVyhozu | ceil(PocetKS / PROD) |
| PrvniRole (CD_POP) | floor(PrvniJizd / PocetCnaRoli) |
| Cislo0Jizd (CD_POP) | PrvniJizd + (vyhoz-1) * PocetCnaRoli |
| KoncCisloRole | CisloRole - CiselNaRoli + 1 |
| DPB modulo | lastDigit(floor(reverse(b3+c3) / (b3+c3))) |
| IGT Predcisli2 | Predcisli3 + PredcisliL[p] + r |
| Deleni3 | mezery každé 3 cifry zleva |

---

---

## 10. Výstupy aplikace (složka Vystupy)

Struktura odpovídá `[ADRESA]` (např. `Vystupy/A17144` nebo `Vystupy/A16898`).

### 10.1 TXT – hotové krabice

**Cesta:** `REZANI/[JOB]/TXT/[cislo]_[Serie].txt`

**Formát řádku dat:** `Ks|Serie|KoncCisloRole|CisloRoleF`
- **Ks** – pořadové číslo v krabici (2 cifry, obrácené pořadí)
- **Serie** – identifikátor série (IE, IF, TIB, …)
- **KoncCisloRole** – první číslo v krabici (formátované)
- **CisloRoleF** – poslední číslo v krabici

**Metadata na konci souboru:**
```
JOB: [JOB]
SERIE: [Serie]           # pouze IGT_Sazka
CISLO_KRABICE: [cislo]
PRODUKCE: [1-6]
C_KRAB_NA_PALETE: [cislo] # nebo CISLO_PALETY pro IGT_Sazka
MNOZSTVI: [n] ks
BALIL: [jméno]
CAS: [datum]
```

**IGT_Sazka** – název souboru: `[cislo]_[CisloZak]_[CisloPalety]_[Predcisli].txt`  
Příklad: `17020_A 171414_01_110.txt`

### 10.2 INKJETY – štítky pro IGT (jehličková tiskárna)

**Cesta:** `REZANI/IGT_Sazka/Sestavy_IGT/INKJETY/[CisloPalety]_[CisloKrabice].txt`

**Formát** – prostý text pro EPSON FX-890:
- Řádky 1–70: první strana (řádky 1–70 z TXT)
- Řádky 85–158: druhá strana (řádky 85–158 z TXT)
- Pro každou krabici: číslo krabice, váha (5,40 kg), OD/DO čísla, série, intervaly rolí, počet rolí, celkem

**Struktura bloku pro 1 krabici:**
```
[30 mezer][CisloKrabice][75 mezer]5,40 kg
[30 mezer][Zacatek]
[30 mezer][Konec]
[2 prázdné řádky]
[30 mezer][SERIE]
[2 prázdné řádky]
[Intervaly: Od-Do][mezery][Počet]
[17 prázdných řádků]
```

### 10.3 CSV – sestavy pro ČD (CD_Vnitro, CD_Validator)

**Sestava_CD ZS Praha** – sloupce: `Poř.č.; Série; OD; DO; KS; Č. krab.`
- OD/DO = čísla rolí v krabici
- KS = počet kusů
- Při přerušení řady: dva řádky (např. `IE;901;;01;008.` a `IE;904;914;11;008.`)

**Sestava_CD Zlin** – sloupce: `Serie; Pořadí; poř./OD; Č.krab.celk.; Expedice; Poznámka`
- Formát pořadí: `001.;01./987` (číslo krabice; pořadí/číslo role)

**Sestava_Kontrola** – sloupce: `Krab.č; nazev Txt; Č.kr.na pal.; Série; OD; KS; Přer. řady`
- Detailní kontrola každé role v krabici
- Přer. řady = prázdné nebo "PŘ" při přerušení

### 10.4 PDF – balné listy a štítky

**Cesta:** `REZANI/[JOB]/PDF/`
- `[CISLO]_[C_KRAB_NA_PALETE]BL.pdf` – balný list (A4)
- `[CISLO]_[C_KRAB_NA_PALETE]ST.pdf` – štítek (A4, 2×5 štítků)

**IGT_Sazka** – paletové listy: `Sestavy_IGT/PALETY/PAL_[nazev].pdf`

### 10.5 Settings.xml – poslední stav

**Cesta:** `REZANI/[JOB]/Settings.xml`

**Struktura:**
```xml
<root>
  <cisla_od>
    <[Serie] name="[cislo],[ks] ks,[paleta],[krabice]">[n]. prod.</[Serie]>
  </cisla_od>
  <balil>
    <jmeno name="[jméno]">vyst_kontrola</jmeno>
  </balil>
</root>
```

### 10.6 Sestavy pro IGT (TextakSazka)

**Cesta:** `Sestavy_IGT/SESTAVY/S_[datum].txt`

**Formát (TAB oddělovač):**
```
ShipmentDate	CisloZakazky	CisloPalety	CisloKrabice	CisloRolky	Serie	PocatekCislovani	KonecCislovani
```

---

## 11. Hlavní tok aplikace (IG.py)

Z analýzy IG.pyc (co_names, co_consts):

1. **Start** – inicializace, DPI awareness (Windows)
2. **SetXML** – načtení FixSettings.xml
3. **CteniXML** – parsování XML pro JOB
4. **DictToShelve / ShelveToDict** – práce s VarSettings
5. **ResetShelve** – reset dat
6. **Okno1** – hlavní okno (výběr JOB)
7. **Okno2** – sekundární okno
8. **CreateFiles** – vytvoření adresářové struktury
9. Volání **ModulGenerovani_9.Generovani(JOB)** nebo **Kontrola_9.Kontrola(JOB)** / **Kontrola_NEXGO** / **Kontrola_IGT_Sazka** podle typu JOB

**Routing JOB → modul:**
- CD_Vnitro, CD_Validator, CD_POP, DPB_AVJ → Kontrola_9
- CD_POP_NEXGO → Kontrola_NEXGO
- IGT_Sazka → Kontrola_IGT_Sazka

---

*Dokumentace vytvořena reverzní analýzou Python zdrojového kódu z IG.exe (PyInstaller). Sekce výstupů doplněna analýzou složky Vystupy.*
