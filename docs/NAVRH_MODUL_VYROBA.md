# Návrh řešení a plán implementace – Modul Výroba

**Pracovní název:** Výroba  
**Verze dokumentu:** 1.1  
**Datum:** 18. 3. 2025  
**Poslední aktualizace:** 18. 3. 2025  
**Zdroje:** DOKUMENTACE_KOMPLETNI_vyrobaceniny.md, IG.exe_extracted

---

## Stav implementace (k 18. 3. 2025)

**Hotové fáze:** 1, 2, 3, 4, 5, 6

| Fáze | Stav | Popis |
|------|------|-------|
| 1 | ✅ | Infrastruktura – Prisma, API, layout, stránky |
| 2 | ✅ | Generování – všech 6 typů JOB (CreateVnitro, POP, NEXGO, DPB_AVJ, IGT_Sazka) |
| 3 | ✅ | Kontrola + výhoz – grid, DB, TXT export/import, opravy |
| 4 | ✅ | Protokoly – balný list, štítek, paleta IGT, inkjety TXT |
| 5 | ✅ | Zaměstnanci – CRUD API, nastavení ADRESA/JOB |
| 6 | ✅ | Testování, dokumentace, tisk |

---

## 1. Shrnutí

Modul **Výroba** migruje funkcionalitu desktopové aplikace IG52 (Python/wxPython) do Next.js. Zaměřuje se na správu výroby a balení loterních produktů (jízdenky ČD, stírací losy Sazka, kotouče) – generování dat pro tiskárny, kontrolu balení a tvorbu protokolů.

---

## 2. Cíle modulu

| Cíl | Popis |
|-----|-------|
| **Generování** | Vytváření datových souborů (CSV/TXT) pro tiskárny podle typu JOB |
| **Kontrola** | Sledování balení – výhoz, krabice, palety, číslování |
| **Protokoly** | Generování balných listů, štítků a PDF sestav |
| **Konfigurace** | Správa fixních a variabilních parametrů pro jednotlivé JOB typy |

---

## 3. Architektura řešení

### 3.1 Přehled komponent

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        FRONTEND (React / Next.js)                        │
├─────────────────────────────────────────────────────────────────────────┤
│  /vyroba                    │  Hlavní dashboard – výběr JOB             │
│  /vyroba/[job]              │  Parametry výroby (serie, ks, …)         │
│  /vyroba/generovani/[job]   │  Generování dat (Create*)                 │
│  /vyroba/kontrola/[job]     │  Kontrola balení, výhoz, protokoly       │
│  /vyroba/nastaveni          │  Konfigurace ADRESA, JOB, zaměstnanci     │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                        API (Route Handlers)                              │
├─────────────────────────────────────────────────────────────────────────┤
│  /api/vyroba/jobs              │  Seznam JOB typů                       │
│  /api/vyroba/jobs/[job]/config │  GET/PUT konfigurace JOB               │
│  /api/vyroba/address            │  GET/PUT ADRESA                        │
│  /api/vyroba/employees          │  GET/POST – zaměstnanci               │
│  /api/vyroba/employees/[id]     │  PATCH/DELETE – úprava, deaktivace     │
│  /api/vyroba/generate/[job]     │  POST – generování dat                │
│  /api/vyroba/control/[job]      │  POST – výhoz, opravit                  │
│  /api/vyroba/control/[job]/export-txt  │  GET – export stavu jako TXT   │
│  /api/vyroba/control/[job]/import-txt  │  POST – import TXT do DB        │
│  /api/vyroba/boxes/[job]        │  GET – rozpracované krabice            │
│  /api/vyroba/protocol/[job]     │  POST – generování PDF/TXT             │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                        BUSINESS LOGIC (lib/vyroba/)                      │
├─────────────────────────────────────────────────────────────────────────┤
│  generators/     │  CreateVnitro, CreateValidator, CreatePOP, ...      │
│  control/        │  ButtonOK logika, RozprcaneKrabice                   │
│  protocol/       │  PDF generování (balné listy, štítky)                 │
│  utils/         │  Deleni3, CteniXML, výpočty                          │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                        DATOVÁ VRSTVA                                     │
├─────────────────────────────────────────────────────────────────────────┤
│  Prisma (MySQL)  │  vyroba_job_config, vyroba_boxes, vyroba_files, ...  │
│  File system     │  [ADRESA]/TISK/, REZANI/, TXT/, PDF/, CSV/           │
└─────────────────────────────────────────────────────────────────────────┘
```

### 3.2 Typy JOB (produkty)

| JOB | Popis | Klient | Specifické vlastnosti |
|-----|-------|--------|------------------------|
| CD_POP | Jízdní doklady POP | ČD | Variabilní PocetCnaRoli |
| CD_POP_NEXGO | Jízdní doklady NEXGO | ČD | Fixní 160 ks/roli |
| CD_Vnitro | Vnitřní jízdenky | ČD | 6 zaváděcích + hlavní + 4 koncové řádky |
| CD_Validator | Validační jízdenky | ČD | Podobné CD_Vnitro |
| DPB_AVJ | Kotouče | – | Skip kontrola, modulo výpočet, 300 výběh |
| IGT_Sazka | Stírací losy | Sazka | PredcisliL, paletové listy, sestavy IGT |

---

## 4. Datový model (Prisma)

### 4.1 Nové tabulky

```prisma
// ─── Modul Výroba (IG52 migrace) ────────────────────────────────────────

/// Globální nastavení – ADRESA, FixSettings
model vyroba_settings {
  id          Int      @id @default(autoincrement())
  setting_key String   @unique @db.VarChar(100)   // např. "ADRESA"
  setting_val String?  @db.VarChar(500)
  updated_at  DateTime @updatedAt @db.DateTime(0)

  @@map("vyroba_settings")
}

/// Konfigurace JOB (nahrazuje VarSettings shelve)
model vyroba_job_config {
  id              Int      @id @default(autoincrement())
  job             String   @unique @db.VarChar(50)   // CD_POP, IGT_Sazka, ...
  stav            String   @default("Volny") @db.VarChar(20)
  serie           Json     @db.Json                   // ["XB","XC",...]
  pocet_cna_roli  Int?     @db.Int
  ks_v_krabici    Int      @default(20) @db.Int
  prvni_role      Int      @default(0) @db.Int
  prvni_jizd      Int      @default(0) @db.Int
  prod            Int      @default(6) @db.Int
  skip            Int?     @db.Int                    // DPB_AVJ
  predcisli       Json?    @db.Json                   // IGT_Sazka
  paleta          Json?    @db.Json                   // stav palety
  cislo_zakazky   String?  @db.VarChar(20)            // IGT_Sazka
  updated_at      DateTime @updatedAt @db.DateTime(0)

  @@map("vyroba_job_config")
}

/// Zaměstnanci – baliči (nahrazuje Zamestnanci.txt)
model vyroba_employees {
  id        Int      @id @default(autoincrement())
  name      String   @db.VarChar(100)
  sort_order Int     @default(0) @db.Int
  is_active Boolean  @default(true) @db.TinyInt
  created_at DateTime @default(now()) @db.DateTime(0)

  @@map("vyroba_employees")
}

/// Rozpracované krabice – stav pro rychlé načtení
model vyroba_box_state {
  id           Int      @id @default(autoincrement())
  job          String   @db.VarChar(50)
  production   Int      @db.Int              // číslo produkce (1–6)
  cislo_role   String   @db.VarChar(50)
  ks_v_krabici Int      @db.Int
  c_krab_na_palete Int? @db.Int
  updated_at   DateTime @updatedAt @db.DateTime(0)

  @@unique([job, production])
  @@map("vyroba_box_state")
}

/// Audit / historie výhozů (volitelné pro reporting)
model vyroba_audit {
  id         Int      @id @default(autoincrement())
  job        String   @db.VarChar(50)
  action     String   @db.VarChar(50)   // "vyhoz", "generovani", "protokol"
  user_id    Int?
  details    Json?    @db.Json
  created_at DateTime @default(now()) @db.DateTime(0)

  @@index([job, created_at])
  @@map("vyroba_audit")
}
```

### 4.2 Fixní parametry (FixSettings)

Fixní parametry zůstanou v konfiguračním souboru (JSON/XML) nebo v tabulce `vyroba_fix_config`:

```typescript
// lib/vyroba/config/fix-settings.ts
export const FIX_SETTINGS: Record<string, FixJobConfig> = {
  CD_POP:        { cisNaRoli: 'x', pocCislic: 6, pocetHlav: 6 },
  CD_POP_NEXGO:  { cisNaRoli: 160, pocCislic: 6, pocetHlav: 8 },
  CD_Vnitro:     { cisNaRoli: 1000, pocCislic: 7, pocetHlav: 6 },
  CD_Validator:  { cisNaRoli: 500, pocCislic: 7, pocetHlav: 6 },
  DPB_AVJ:       { cisNaRoli: 3600, pocCislic: 5, pocetHlav: 6 },
  IGT_Sazka:     { cisNaRoli: 3283, pocCislic: 6, pocetHlav: 6 },
};
```

---

## 5. Struktura souborů na disku (ADRESA)

Výstupy budou ukládány do konfigurovatelné cesty (env `VYROBA_OUTPUT_PATH` nebo DB):

```
[ADRESA]/
├── TISK/                    # Vygenerovaná data pro tiskárny
│   ├── CD_POP/
│   ├── CD_POP_NEXGO/
│   ├── CD_Vnitro/
│   ├── CD_Validator/
│   ├── DPB_AVJ/
│   └── IGT_Sazka/
└── REZANI/
    └── [JOB]/
        ├── 0.txt, 1.txt, ...   # Rozpracované krabice
        ├── TXT/                 # Hotové krabice
        ├── PDF/                 # Protokoly
        ├── CSV/                 # Sestavy
        ├── Settings.xml         # Poslední stav (volitelně)
        └── Sestavy_IGT/         # Pouze IGT_Sazka
            ├── INKJETY/
            ├── TXT/
            ├── PALETY/
            └── SESTAVY/
```

---

## 6. Klíčové funkce k implementaci

### 6.1 Generování (Create*)

| Funkce | JOB | Popis |
|--------|-----|-------|
| `createVnitro` | CD_Vnitro | Zaváděcí 6× NEPRODEJNE, hlavní část, koncová 4× NEPRODEJNE |
| `createValidator` | CD_Validator | Stejná logika jako Vnitro |
| `createPOP` | CD_POP | Variabilní PocetCnaRoli, formát `Serie c3;` |
| `createNEXGO` | CD_POP_NEXGO | Fixní 160, číslování přes hlavy |
| `createDPB_AVJ` | DPB_AVJ | Skip kontrola, modulo, 14 zaváděcích, 300 výběh |
| `createIGT_Sazka` | IGT_Sazka | Cyklus Predcisli, formát `Serie_Predcisli_PoradCislo` |

### 6.2 Kontrola (ButtonOK)

- Načtení stavu z `vyroba_box_state` + TXT souborů
- Výpočet `KoncCisloRole`, zápis řádku do TXT
- Při plné krabici: metadata, přesun do TXT/, přejmenování
- Aktualizace `vyroba_box_state`
- Volání generování protokolu (PDF)

### 6.3 Pomocné funkce

- `deleni3(line)` – formátování čísel s mezerami po 3 cifrách
- `rozprcaneKrabice(job)` – načtení stavu z TXT + DB
- `cteniFixConfig(job)` – načtení fixních parametrů

### 6.4 Protokoly

- **Balný list (BL)** – PDF A4, tabulka Od–Do
- **Štítek (ST)** – PDF A4, 2×5 štítků
- **IGT Sazka** – paletový list, štítky pro jehličkovou tiskárnu (TXT)

---

## 7. Plán implementace

### Fáze 1: Základní infrastruktura (1–2 týdny) ✅

| # | Úkol | Výstup | Stav |
|---|------|--------|------|
| 1.1 | Prisma migrace – nové tabulky | `vyroba_*` modely | ✅ |
| 1.2 | Přidat `vyroba` do `getLayoutAccess` a Sidebar | Navigace v aplikaci | ✅ |
| 1.3 | Seed / inicializace FixSettings, default ADRESA | Konfigurace | ✅ |
| 1.4 | API: `GET/PUT /api/vyroba/address` | Základní API | ✅ |
| 1.5 | API: `GET/PUT /api/vyroba/jobs/[job]/config` | Konfigurace JOB | ✅ |
| 1.6 | Stránka `/vyroba` – dashboard s výběrem JOB | UI základ | ✅ |

### Fáze 2: Generování (2–3 týdny) ✅

| # | Úkol | Výstup | Stav |
|---|------|--------|------|
| 2.1 | `lib/vyroba/utils/deleni3.ts` | Pomocná funkce | ✅ |
| 2.2 | `lib/vyroba/generators/createVnitro.ts` | CD_Vnitro | ✅ |
| 2.3 | `lib/vyroba/generators/createValidator.ts` | CD_Validator | ✅ |
| 2.4 | `lib/vyroba/generators/createPOP.ts` | CD_POP | ✅ |
| 2.5 | `lib/vyroba/generators/createNEXGO.ts` | CD_POP_NEXGO | ✅ |
| 2.6 | `lib/vyroba/generators/createDPB_AVJ.ts` | DPB_AVJ | ✅ |
| 2.7 | `lib/vyroba/generators/createIGT_Sazka.ts` | IGT_Sazka | ✅ |
| 2.8 | API `POST /api/vyroba/generate/[job]` | Endpoint generování | ✅ |
| 2.9 | UI `/vyroba/generovani/[job]` | Formulář + spuštění | ✅ |

### Fáze 3: Kontrola a výhoz (2–3 týdny) ✅

| # | Úkol | Výstup | Stav |
|---|------|--------|------|
| 3.1 | Načtení stavu z DB + TXT | `lib/vyroba/control/calculations.ts`, `txt-io.ts` | ✅ |
| 3.2 | Logika výhozu – CD_Vnitro, CD_Validator, CD_POP, DPB_AVJ | ButtonOK v control API | ✅ |
| 3.3 | Logika výhozu CD_POP_NEXGO | Stejný endpoint | ✅ |
| 3.4 | Logika výhozu IGT_Sazka | Stejný endpoint | ✅ |
| 3.5 | API `POST /api/vyroba/control/[job]` | Endpoint výhozu, opravit | ✅ |
| 3.6 | API `GET /api/vyroba/boxes/[job]` | Stav krabic | ✅ |
| 3.7 | UI `/vyroba/kontrola/[job]` | Kontrolní obrazovka (pólové číslo, OK, <, <<, >, >>) | ✅ |

### Fáze 4: Protokoly a sestavy (1–2 týdny) ✅

| # | Úkol | Výstup | Stav |
|---|------|--------|------|
| 4.1 | `lib/vyroba/protocol/pdf-baleni-list.ts` | Balný list PDF (pdf-lib) | ✅ |
| 4.2 | `lib/vyroba/protocol/pdf-stitek.ts` | Štítek PDF | ✅ |
| 4.3 | `lib/vyroba/protocol/igt-paleta.ts` | Paletový list IGT | ✅ |
| 4.4 | `lib/vyroba/protocol/igt-inkjety.ts` | TXT pro jehličkovou tiskárnu | ✅ |
| 4.5 | API `POST /api/vyroba/protocol/[job]` | Generování PDF | ✅ |
| 4.6 | UI tisk/náhled protokolů | Integrace do kontroly | ✅ |

### Fáze 5: Zaměstnanci a nastavení (1 týden) ✅

| # | Úkol | Výstup | Stav |
|---|------|--------|------|
| 5.1 | CRUD `vyroba_employees` | API + UI | ✅ |
| 5.2 | Stránka `/vyroba/nastaveni` | Konfigurace ADRESA, JOB, zaměstnanci | ✅ |
| 5.3 | Migrace z VarSettings.dat (volitelně) | Import existujících dat | ⏸️ |

### Fáze 6: Ostré nasazení a testování (1–2 týdny) ✅

| # | Úkol | Výstup | Stav |
|---|------|--------|------|
| 6.1 | E2E testy kritických flow | Unit testy (Vitest), E2E (Playwright) | ✅ |
| 6.2 | Dokumentace pro uživatele | MANUAL_VYROBA.md | ✅ |
| 6.3 | Řešení tisku | VYROBA_TISK.md – možnosti, doporučení | ✅ |

---

## 8. Technické poznámky

### 8.1 Závislosti

- **pdf-lib** – generování PDF (balné listy, štítky)
- **DejaVu fonty** – pro správné zobrazení diakritiky v PDF

### 8.2 Bezpečnost

- Ověření přístupu k modulu `vyroba` v každém API route
- Validace vstupů (PocetKS, čísla rolí)
- Omezení přístupu k souborovému systému (ADRESA uvnitř povolené cesty)

### 8.3 Tisk

Původní IG52 používá `win32print` a EPSON FX-890. Možnosti pro Next.js:

1. **Stažení PDF** – uživatel tiskne ručně
2. **Cloud Print API** – pokud je k dispozici
3. **Backend služba** – samostatný proces na Windows serveru s přístupem k tiskárně

### 8.4 Migrace z IG52

- VarSettings.dat (shelve) → migrační skript na vyčtení pickle a zápis do DB
- Zamestnanci.txt → import do `vyroba_employees`
- FixSettings.xml → převod do `lib/vyroba/config/fix-settings.ts` nebo DB

---

## 9. Rizika a mitigace

| Ríziko | Mitigace |
|--------|----------|
| Rozdíly v chování oproti IG52 | Detailní unit testy na výpočty (PocetVyhozu, CisloRole, modulo) |
| Výkon při velkém souboru | Streamování, omezení velikosti jedné dávky |
| Tisk na jehličkovou tiskárnu | Zachovat TXT výstup pro EPSON; tisk přes externí nástroj |
| Souběžní přístup více uživatelů | Optimistic locking pro vyroba_box_state |

---

## 10. Shrnutí časového odhadu

| Fáze | Odhad |
|------|-------|
| Fáze 1 – Infrastruktura | 1–2 týdny |
| Fáze 2 – Generování | 2–3 týdny |
| Fáze 3 – Kontrola | 2–3 týdny |
| Fáze 4 – Protokoly | 1–2 týdny |
| Fáze 5 – Nastavení | 1 týden |
| Fáze 6 – Testování | 1–2 týdny |
| **Celkem** | **8–13 týdnů** |

---

## 11. Implementované komponenty (detailní popis)

### 11.1 Fáze 1 – Infrastruktura

| Komponenta | Cesta / popis |
|------------|---------------|
| Prisma modely | `vyroba_settings`, `vyroba_job_config`, `vyroba_employees`, `vyroba_box_state`, `vyroba_audit` |
| Layout | Modul „Výroba“ v Sidebar, přístup dle `getLayoutAccess` |
| API ADRESA | `GET/PUT /api/vyroba/address` |
| API JOB | `GET /api/vyroba/jobs`, `GET/PUT /api/vyroba/jobs/[job]/config` |
| Stránky | `/vyroba` (dashboard), `/vyroba/nastaveni` |

### 11.2 Fáze 2 – Generování

| Komponenta | Soubor | Popis |
|------------|--------|-------|
| createVnitro | `lib/vyroba/generators/createVnitro.ts` | CD_Vnitro – zaváděcí 6× NEPRODEJNE, hlavní část, koncová 4× |
| createValidator | `lib/vyroba/generators/createValidator.ts` | CD_Validator |
| createPOP | `lib/vyroba/generators/createPOP.ts` | CD_POP – variabilní PocetCnaRoli |
| createNEXGO | `lib/vyroba/generators/createNEXGO.ts` | CD_POP_NEXGO – fixní 160 ks/roli |
| createDPB_AVJ | `lib/vyroba/generators/createDPB_AVJ.ts` | DPB_AVJ – skip, modulo, 14 zaváděcích |
| createIGT_Sazka | `lib/vyroba/generators/createIGT_Sazka.ts` | IGT_Sazka – PredcisliL |

- **API:** `POST /api/vyroba/generate/[job]`
- **UI:** `/vyroba/generovani/[job]` – formulář s parametry, spuštění generování

### 11.3 Fáze 3 – Kontrola a výhoz

| Komponenta | Popis |
|------------|-------|
| Tok | `/vyroba` → Parametry výroby → `/vyroba/[job]` → TISK → generovani, REZANI → kontrola |
| Kontrolní obrazovka | `/vyroba/kontrola/[job]` – světle modré okno, grid (checkbox, Série, Od–Do, +/−, ks) |
| Navigace | «« « ‹ OK › » »› »», Turbo režim |
| Zdroj dat | `vyroba_box_state`, `hot_krab` v `vyroba_job_config` |
| TXT export | `GET /api/vyroba/control/[job]/export-txt` – stáhnout aktuální stav |
| TXT import | `POST /api/vyroba/control/[job]/import-txt` – nahrát TXT a aktualizovat DB |
| Opravit | Režim úprav v gridu, akce `opravit` v control API |
| Výhoz | Akce `vyhoz` – zápis do DB, při plné krabici (CD) automatické generování protokolu |

- **Logika:** `lib/vyroba/control/calculations.ts`, `lib/vyroba/control/txt-io.ts`

### 11.4 Fáze 4 – Protokoly a sestavy

| Komponenta | Soubor | Popis |
|------------|--------|-------|
| Balný list | `lib/vyroba/protocol/pdf-baleni-list.ts` | PDF A4, tabulka Poř. č., Serie, Od č., Do č. |
| Štítek | `lib/vyroba/protocol/pdf-stitek.ts` | PDF štítek pro krabici |
| Paleta IGT | `lib/vyroba/protocol/igt-paleta.ts` | Paletový list IGT |
| Inkjety | `lib/vyroba/protocol/igt-inkjety.ts` | TXT pro jehličkovou tiskárnu EPSON FX |

- **API:** `POST /api/vyroba/protocol/[job]` – typy: `both`, `balny-list`, `stitek` (CD), `igt-paleta`, `igt-inkjety` (IGT)
- **UI:** Tlačítko „Protokol“ (CD), „Sestava“ a „Paleta“ (IGT) v kontrole; automatické otevření PDF po výhozu při plné krabici (CD)
- **Závislosti:** pdf-lib, @pdf-lib/fontkit, dejavu-fonts-ttf

### 11.5 Fáze 5 – Zaměstnanci a nastavení

| Komponenta | Popis |
|------------|-------|
| API zaměstnanci | `GET/POST /api/vyroba/employees`, `PATCH/DELETE /api/vyroba/employees/[id]` |
| CRUD operace | Přidání, úprava jména, deaktivace (soft delete), reaktivace |
| Stránka nastavení | `/vyroba/nastaveni` – ADRESA, odkazy na JOB parametry, tabulka zaměstnanců |

**Poznámka:** Migrace z VarSettings.dat (5.3) je volitelná a zatím není implementována.

### 11.6 Fáze 6 – Testování a dokumentace

| Komponenta | Popis |
|------------|-------|
| Unit testy | Vitest – `lib/vyroba/utils/deleni3.test.ts`, `pocet-vyhozu.test.ts`, `control/calculations.test.ts`, `txt-io.test.ts` |
| E2E testy | Playwright – `e2e/vyroba.spec.ts` (smoke testy stránek) |
| Uživatelský manuál | `docs/MANUAL_VYROBA.md` |
| Tisk | `docs/VYROBA_TISK.md` – možnosti tisku, formáty |

**Příkazy:** `npm run test` (unit), `npm run test:e2e` (E2E)

---

*Dokument připraven pro zahájení implementace modulu Výroba v rámci projektu APPIntegraf-NEXT.*
