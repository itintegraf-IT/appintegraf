# Specifikace implementace — štítkový systém (přepis XLSM)

> Zdroj: reverzní analýza `A17984_Standard_hotovo.xlsm`  
> Určeno pro: autonomního kodéra / AI agenta  
> Verze: 1.0 | 2026-05-22

---

## 1. Datový model (Prisma)

### 1.1 Tabulka `Order` (zakázka)

Mapuje list **List1**, řádky 3–7 (max 5 štítků na zakázku).

```prisma
model Order {
  id          String   @id @default(cuid())
  orderNumber String   @unique          // List1!B1 – např. "A17984"
  templateKey String                    // List1!K3 – "Standard" | "neut" | "Oriflame"
  status      OrderStatus @default(DRAFT)
  createdBy   String                    // Windows USERNAME → JWT sub
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  lastChangedBy String?                 // Legenda!M2 "Poslední změna: user | dd/mm/yyyy"

  rows        LabelRow[]
  auditLogs   AuditLog[]
}

enum OrderStatus {
  DRAFT           // "Uložit jako rozpracované"
  SUBMITTED       // "Zadat do výroby pro mailing" → email odeslán
  SUBMITTED_MISTRI // "Zadat do výroby pro mistry" → bez emailu
  PRINTED         // tiskař klikl Tisk/PDF a potvrdil
  DONE            // "Zpracováno" → soubor přesunut do hotove_stitky
}
```

### 1.2 Tabulka `LabelRow` (řádek štítku v zakázce)

Jeden řádek = jeden typ štítku. Zakázka má 1–5 řádků (řádky 3–7 v List1).

```prisma
model LabelRow {
  id         String  @id @default(cuid())
  orderId    String
  order      Order   @relation(fields: [orderId], references: [id], onDelete: Cascade)
  rowIndex   Int     // 1–5 (pořadí v zakázce)

  // Sloupec B – množství (List1!B3..B7)
  quantity   Int?    // musí být celé číslo > 0; musí být >= packSize

  // Sloupec C – balení (List1!C3..C7)
  packSize   Int?    // musí být celé číslo > 0; quantity % packSize === 0 (implicitní) – VBA to nekontroluje, ale logicky musí platit

  // Sloupce D, E, F – texty štítku (List1!D..F)
  text1      String? // max délka: prakticky neomezena, VBA nekontroluje
  text2      String?
  text3      String? // pouze pro šablonu != Oriflame

  // Sloupec G – prefix číselné řady (List1!G3..G7)
  prefix     String? // může být prázdný; text, např. "REF"

  // Sloupce H, I – rozsah číselné řady (List1!H3..I7)
  rangeFrom  String? // uloženo jako STRING kvůli leading zeros, např. "0001"
  rangeTo    String? // uloženo jako STRING

  // Sloupec J – typ čárového kódu (List1!J3..J7) – aktuálně nepoužito v tisku, jen info
  barcodeType String? // "Standard", "Code 128", "EAN 13" atd. (výčet z Legenda!L:L)
}
```

### 1.3 Tabulka `Template` (šablona štítku)

Mapuje list **Legenda**, sloupce M–T, řádky 3+.

```prisma
model Template {
  key         String  @id   // "Standard" | "Standard IG" | "Neutrální" | "Oriflame" atd.
  sheetName   String        // název listu v excelu → v Node.js: klíč pro React komponentu
  rowStart    Int           // Radek_PP: první řádek pro číslo (Standard=2)
  rowStep     Int           // Radek_krok: krok mezi řádky (Standard=7)
  rowEnd      Int           // Radek_PK: poslední řádek (Standard=49)
  colStart    Int           // Sloupec_PP: první sloupec (Standard=1)
  colStep     Int           // Sloupec_Krok: krok mezi sloupci (Standard=4)
  colEnd      Int           // Sloupec_PK: poslední sloupec (Standard=6)
}
```

**Seeded hodnoty z Legenda (přesná data z xlsm):**

| key | sheetName | rowStart | rowStep | rowEnd | colStart | colStep | colEnd | štítků/strana |
|-----|-----------|----------|---------|--------|----------|---------|--------|---------------|
| Standard | Standard | 2 | 7 | 49 | 1 | 4 | 6 | ~(7řádků × 2sloupce) = 14? ← viz níže |
| Standard IG | Standard | 2 | 7 | 49 | 1 | 4 | 6 | — |
| Neutrální | neut | 2 | 7 | 49 | 1 | 4 | 6 | — |
| Oriflame | Oriflame | 2 | 9 | 34 | 1 | 5 | 9 | — |

> ⚠️ **Výpočet počtu štítků na stranu:**  
> `cols = floor((colEnd - colStart) / colStep) + 1`  
> `rows = floor((rowEnd - rowStart) / rowStep) + 1`  
> Pro Standard: cols = (6-1)/4+1 = 2, rows = (49-2)/7+1 = 8 → **16 štítků/strana**  
> Pro Oriflame: cols = (9-1)/5+1 = 2, rows = (34-2)/9+1 = 5 → **10 štítků/strana**

### 1.4 Tabulka `User`

```prisma
model User {
  id           String   @id @default(cuid())
  username     String   @unique  // Windows login (Legenda!W2..Wn) → web login
  passwordHash String
  role         UserRole @default(ZADAVATEL)
  email        String?
  active       Boolean  @default(true)
  createdAt    DateTime @default(now())
  orders       Order[]  @relation("createdBy")  // přes orderId
  auditLogs    AuditLog[]
}

enum UserRole {
  ZADAVATEL   // může vytvořit zakázku, odeslat
  MISTER      // může tisknout, ukládat pro mistry
  TISKAR      // může tisknout, označit Zpracováno (S_901 whitelist)
  ADMIN       // správa uživatelů, šablon
}
```

### 1.5 Tabulka `AuditLog`

Náhrada za `Range("M2") = "Poslední změna: " & user & " | " & datum`.

```prisma
model AuditLog {
  id        String   @id @default(cuid())
  orderId   String
  order     Order    @relation(fields: [orderId], references: [id])
  userId    String
  user      User     @relation(fields: [userId], references: [id])
  action    String   // "CREATED" | "SUBMITTED" | "PRINTED" | "DONE" | "SAVED_DRAFT" atd.
  detail    String?  // volitelný JSON nebo text
  createdAt DateTime @default(now())
}
```

---

## 2. Validační logika (`lib/validators/orderRow.ts`)

Přesný přepis **S_800_Kontrola_zadani** (VBA → Zod + custom checks).

### 2.1 Fáze 1 — formátová validace (každý znak)

VBA kontroluje každý znak polí `quantity`, `packSize`, `rangeFrom`, `rangeTo` — musí být pouze číslice `[0-9]`. Zod ekvivalent:

```typescript
const numericString = z.string().regex(/^\d+$/, 'Pole musí obsahovat pouze číslice');

// quantity a packSize jsou Int, ale vstup z formuláře je string → parsovat
const positiveInt = z.string()
  .regex(/^\d+$/, 'Pouze číslice')
  .transform(Number)
  .refine(n => n > 0, 'Musí být větší než 0');
```

### 2.2 Fáze 2 — povinnost polí (pravidla z VBA)

Tato pravidla se vyhodnocují PER ŘÁDEK. Řádek je "aktivní" pokud má vyplněné alespoň jedno pole.

| Podmínka (VBA logika) | Chybová hláška (přeložit do CZ) |
|---|---|
| `quantity` je prázdné, ale jiné pole není | `"Na řádku X chybí zadané Množství"` |
| `quantity` vyplněno, ale `packSize` prázdné | `"Na řádku X chybí zadané Balení"` |
| `quantity < packSize` | `"Na řádku X je Množství menší než Počet ks v balení"` |
| `quantity` vyplněno, ale text1='' AND text2='' AND text3='' | `"Na řádku X není vyplněn ani jeden Text"` |
| `rangeFrom` prázdné, ale `rangeTo` vyplněno | `"Na řádku X chybí vyplněn Počátek číselné řady"` |
| `rangeTo` prázdné, ale `rangeFrom` vyplněno | `"Na řádku X chybí vyplněn Konec číselné řady"` |
| `rangeFrom > rangeTo` (po numeric parse) | `"Na řádku X je Konec číselné řady menší než Počátek"` |
| `(rangeTo - rangeFrom + 1) != quantity` | `"Na řádku X neodpovídá zadané MNOŽSTVÍ a ROZSAH ŘADY"` |

> **Speciální případ leading zeros:** VBA normalizuje `"1"`, `"01"`, `"001"` ... `"0000000000001"` → číslo `1` před porovnáním. TypeScript:  
> ```typescript
> const parseRange = (s: string): number => parseInt(s, 10); // parseInt ignoruje leading zeros
> ```

### 2.3 Fáze 3 — globální validace zakázky

| Podmínka | Chybová hláška |
|---|---|
| `orderNumber` (List1!B1) je prázdné | `"V buňce B2 chybí zadané Číslo zakázky"` (VBA říká B2, ale je to B1 — zachovat text) |
| `templateKey` (List1!K3) je prázdné | `"Na řádku 3 ve Sloupci 11, není vybrána šablona pro štítky"` |
| Žádný řádek není aktivní (vše prázdné) | vlastní: `"Zakázka neobsahuje žádné štítky"` |

### 2.4 Zod schéma (kompletní)

```typescript
// lib/validators/orderRow.ts
import { z } from 'zod';

export const labelRowSchema = z.object({
  rowIndex: z.number().int().min(1).max(5),
  quantity: z.union([z.null(), z.string().regex(/^\d+$/).transform(Number).refine(n => n > 0)]),
  packSize: z.union([z.null(), z.string().regex(/^\d+$/).transform(Number).refine(n => n > 0)]),
  text1: z.string().optional().nullable(),
  text2: z.string().optional().nullable(),
  text3: z.string().optional().nullable(),
  prefix: z.string().optional().nullable(),
  rangeFrom: z.string().regex(/^\d*$/).optional().nullable(),
  rangeTo: z.string().regex(/^\d*$/).optional().nullable(),
  barcodeType: z.string().optional().nullable(),
}).superRefine((row, ctx) => {
  const active = row.quantity != null || row.packSize != null ||
    row.text1 || row.text2 || row.text3 || row.rangeFrom || row.rangeTo;
  if (!active) return; // prázdný řádek – přeskočit

  if (row.quantity == null) {
    ctx.addIssue({ code: 'custom', message: `Řádek ${row.rowIndex}: chybí Množství` });
    return;
  }
  if (row.packSize == null) {
    ctx.addIssue({ code: 'custom', message: `Řádek ${row.rowIndex}: chybí Balení` });
  }
  if (row.quantity < (row.packSize ?? 0)) {
    ctx.addIssue({ code: 'custom', message: `Řádek ${row.rowIndex}: Množství menší než Balení` });
  }
  if (!row.text1 && !row.text2 && !row.text3) {
    ctx.addIssue({ code: 'custom', message: `Řádek ${row.rowIndex}: není vyplněn žádný Text` });
  }
  if (!row.rangeFrom && row.rangeTo) {
    ctx.addIssue({ code: 'custom', message: `Řádek ${row.rowIndex}: chybí Počátek číselné řady` });
  }
  if (row.rangeFrom && !row.rangeTo) {
    ctx.addIssue({ code: 'custom', message: `Řádek ${row.rowIndex}: chybí Konec číselné řady` });
  }
  if (row.rangeFrom && row.rangeTo) {
    const od = parseInt(row.rangeFrom, 10);
    const do_ = parseInt(row.rangeTo, 10);
    if (od > do_) {
      ctx.addIssue({ code: 'custom', message: `Řádek ${row.rowIndex}: Konec řady < Počátek` });
    }
    if ((do_ - od + 1) !== row.quantity) {
      ctx.addIssue({ code: 'custom', message: `Řádek ${row.rowIndex}: Množství neodpovídá rozsahu řady (očekáváno ${do_ - od + 1}, zadáno ${row.quantity})` });
    }
  }
});

export const orderSchema = z.object({
  orderNumber: z.string().min(1, 'Chybí číslo zakázky'),
  templateKey: z.string().min(1, 'Není vybrána šablona'),
  rows: z.array(labelRowSchema).min(1),
});
```

---

## 3. Algoritmus generování štítků (`lib/ciselnaRada.ts`)

Přesný přepis **S_900_Ciselna_rada**.

### 3.1 Vstup / výstup

```typescript
interface LabelCell {
  text1: string;
  text2: string;
  text3: string;         // "" pro Oriflame
  rangeLabel: string;    // "Řada: PREFIX 000001 - 001000" nebo "" bez řady
  pocetKs: string;       // "1000 ks" nebo pro Oriflame: "1000"
  zakazka: string;       // číslo zakázky (pro Standard/neut)
  // Oriflame specifická pole:
  oriflameHeader?: string; // "Oriflame Cosmetics S.A."
  totalUnitsLabel?: string; // "Total Units:"
  totalUnitsValue?: string; // packSize jako string
  totalUnitsPcs?: string;   // "pcs"
  barcodeData?: string;    // "(92)text1(37)packSize"
}

interface GenerateResult {
  pages: LabelCell[][];  // každá page = pole buněk pro jednu tiskovou stránku
  totalPages: number;
}

function generateLabels(
  row: LabelRow,
  template: Template,
  orderNumber: string,
  templateKey: string,
): GenerateResult
```

### 3.2 Algoritmus (přesně podle VBA)

```typescript
export function generateLabels(row, template, orderNumber, templateKey): GenerateResult {
  const { quantity, packSize, text1, text2, text3, prefix, rangeFrom, rangeTo } = row;
  const { rowStart, rowStep, rowEnd, colStart, colStep, colEnd } = template;

  // --- Speciální případ: štítek bez číselné řady ---
  // VBA: If Rada_Od = 0 And Rada_Do = 0 Then → generovat od 1 do quantity
  let od: number, do_: number, bezRady: boolean;
  if (!rangeFrom && !rangeTo) {
    od = 1;
    do_ = quantity!;
    bezRady = true;
  } else {
    od = parseInt(rangeFrom!, 10);
    do_ = parseInt(rangeTo!, 10);
    bezRady = false;
  }

  // --- Délka čísel pro leading zeros ---
  // VBA: zvolí delší z rangeFrom / rangeTo a doplní nulami
  const delka = Math.max(
    (rangeFrom ?? '').length,
    (rangeTo ?? '').length,
    1
  );
  const pad = (n: number) => String(n).padStart(delka, '0');

  // --- Iterace řadou ---
  const pages: LabelCell[][] = [];
  let currentPage: LabelCell[] = [];
  let currentRow = rowStart;
  let currentCol = colStart;

  for (let rada = od; rada <= do_; rada += packSize!) {
    // přechod na nový řádek
    if (currentCol > colEnd) {
      currentCol = colStart;
      currentRow += rowStep;
    }
    // strana je plná → flush
    if (currentRow > rowEnd) {
      pages.push(currentPage);
      currentPage = [];
      currentRow = rowStart;
      currentCol = colStart;
    }

    const cisloP = pad(rada);
    const cisloK = pad(Math.min(rada + packSize! - 1, do_));
    const rangeLabel = bezRady ? '' : `Řada: ${prefix ?? ''} ${cisloP} - ${cisloK}`.trim();

    let cell: LabelCell;
    if (templateKey === 'Oriflame') {
      cell = {
        text1: text1 ?? '',
        text2: text2 ?? '',
        text3: '',
        rangeLabel: '',
        pocetKs: '',
        zakazka: '',
        oriflameHeader: 'Oriflame Cosmetics S.A.',
        totalUnitsLabel: 'Total Units:',
        totalUnitsValue: String(packSize),
        totalUnitsPcs: 'pcs',
        barcodeData: `(92)${text1}(37)${packSize}`,
      };
    } else {
      cell = {
        text1: text1 ?? '',
        text2: text2 ?? '',
        text3: text3 ?? '',
        rangeLabel,
        pocetKs: `${packSize} ks`,
        zakazka: orderNumber,
      };
    }

    currentPage.push(cell);
    currentCol += colStep;
  }

  // flush poslední strana (VBA tiskne i nekompletní)
  if (currentPage.length > 0) {
    pages.push(currentPage);
  }

  return { pages, totalPages: pages.length };
}
```

### 3.3 Vzorec počtu stran (z Legenda!B7/B8...)

VBA vypočítá v Legenda!B7: `=(List1!B3/List1!C3)/24` → Legenda!C7: `=CEILING(B7,1)`

Přepis:
```typescript
// Počet tiskových stran pro jeden řádek:
// (quantity / packSize) = počet štítků celkem
// štítků na stránku = floor((rowEnd - rowStart) / rowStep + 1) * floor((colEnd - colStart) / colStep + 1)
export function calcPageCount(row: LabelRow, template: Template): number {
  const totalLabels = Math.ceil(row.quantity! / row.packSize!);
  const labelsPerPage = calcLabelsPerPage(template);
  return Math.ceil(totalLabels / labelsPerPage);
}

export function calcLabelsPerPage(t: Template): number {
  const cols = Math.floor((t.colEnd - t.colStart) / t.colStep) + 1;
  const rows = Math.floor((t.rowEnd - t.rowStart) / t.rowStep) + 1;
  return cols * rows;
}
```

---

## 4. Generování názvů souborů (`lib/fileNames.ts`)

Přepis vzorců z listu **Legenda** (buňky B3–B6):

```typescript
// Legenda!B3 = CONCATENATE(B1, B2) kde B1="" a B2="" → vždy ""
// Legenda!B4 = IF(List1!K3="","", CONCATENATE("_", List1!K3))
// Legenda!B5 = CONCATENATE(List1!B1, B3, B4)  → "A17984_Standard"
// Legenda!B6 = CONCATENATE(List1!B1, B3, B4, "_hotovo") → "A17984_Standard_hotovo"

export function getFileNames(orderNumber: string, templateKey: string) {
  const typeSuffix = templateKey ? `_${templateKey}` : '';
  return {
    // Uložit jako rozpracované (Legenda!B22 = "A17984_rozpracovane"):
    draft: `${orderNumber}_rozpracovane`,
    // Zadat do výroby (Legenda!B5):
    submitted: `${orderNumber}${typeSuffix}`,
    // Po zpracování (Legenda!B6):
    done: `${orderNumber}${typeSuffix}_hotovo`,
    // PDF arch (z S_900):
    pdfPage: (rowIndex: number, lastLabel: number) =>
      `Arch zakazka ${orderNumber} radek ${rowIndex} do stitku ${lastLabel}`,
  };
}
```

---

## 5. Email notifikace (`lib/email.ts`)

Přepis **odeslani_emailu** a **odeslani_emailu_po_vytvoreni**.

### 5.1 Email 1 — při zadání do výroby (Slouceni_Tlacitko)

```typescript
// Legenda!B14 = subject = "A17984 ŠTÍTKY " (text emailu z Legenda!B12/B13)
// Legenda!B13 = body = "{username} Vám posílá požadavek na výrobu štítků."
// Legenda!B21 = recipients = "d.stepan@integraf.cz; m.mateju@integraf.cz"

export async function sendSubmitEmail(params: {
  orderNumber: string;
  submittedBy: string;   // username
  recipients: string[];  // z DB nastavení nebo env
}) {
  const subject = `${params.orderNumber} ŠTÍTKY`;
  const body = `${params.submittedBy} Vám posílá požadavek na výrobu štítků.`;
  await transporter.sendMail({
    from: process.env.SMTP_FROM,
    to: params.recipients.join('; '),
    subject,
    text: body,
  });
}
```

### 5.2 Email 2 — po zpracování (Ukonceni_po_tisku)

```typescript
// Legenda!B16 = subject = "A17984 ŠTÍTKY - HOTOVO"
// Legenda!B17 = body = "{username} zpracoval štítky."

export async function sendDoneEmail(params: {
  orderNumber: string;
  processedBy: string;
  recipients: string[];
}) {
  const subject = `${params.orderNumber} ŠTÍTKY - HOTOVO`;
  const body = `${params.processedBy} zpracoval štítky.`;
  await transporter.sendMail({
    from: process.env.SMTP_FROM,
    to: params.recipients.join('; '),
    subject,
    text: body,
  });
}
```

> Příjemci jsou v XLSM hardcoded v Legenda!B21 jako `"d.stepan@integraf.cz; m.mateju@integraf.cz; operator@integraf.cz"`. V Node.js přesunout do DB tabulky `Settings` nebo ENV proměnné `EMAIL_RECIPIENTS`.

---

## 6. Workflow stavového automatu (`lib/orderStateMachine.ts`)

Přepis posloupnosti maker při jednotlivých tlačítkách v List1.

### 6.1 Tlačítko "Zadat do výroby pro mailing" (`Slouceni_Tlacitko`)

```
1. validateOrder(S_800)          → chyba → STOP, zobrazit chyby
2. sendSubmitEmail()             → odeslat email tiskárně
3. saveFile(path: submitted)     → uložit na W:\stitky_pro_Mailing\
4. deleteFile(draft)             → smazat rozpracovaný soubor
5. changeStatus(SUBMITTED)
6. addAuditLog("SUBMITTED")
7. [Web: redirect na /orders/done]
```

### 6.2 Tlačítko "Zadat do výroby pro mistry" (`Slouceni_Tlacitko_zadani_pro_mistry`)

```
1. validateOrder(S_800)          → chyba → STOP
2. [BEZ emailu]
3. saveFile(path: submitted, dir: stitky_pro_mistry)
4. changeStatus(SUBMITTED_MISTRI)
5. addAuditLog("SUBMITTED_MISTRI")
```

### 6.3 Tlačítko "Uložit jako rozpracované" (`Tlac_Ulozeni_rozprac`)

```
1. saveFile(path: draft)
2. changeStatus(DRAFT)
3. addAuditLog("SAVED_DRAFT")
```

### 6.4 Tlačítko tiskárny 1–5 (`Tisk_stitku_N`)

```
1. authCheck(S_901)              → user musí mít roli TISKAR nebo MISTER
2. validateOrder(S_800)          → chyba → STOP
3. generateLabels(S_900, row N)  → vyplnit šablonu
4. print() nebo exportPDF()      → podle Legenda!B27 "Tisk"/"PDF"
5. addAuditLog("PRINTED", { row: N, output: "Tisk"|"PDF" })
```

### 6.5 Tlačítko "Zpracováno" (`Ukonceni_po_tisku`)

```
1. authCheck(S_901)              → jen TISKAR
2. saveFile(path: done, dir: hotove_stitky)  → přesun do archivu
3. sendDoneEmail()
4. deleteFile(submitted)         → smazat z stitky_pro_Mailing
5. deleteFile(draft)             → smazat rozpracovaný
6. changeStatus(DONE)
7. addAuditLog("DONE")
```

> `Ukonceni_po_tisku_mistri` — stejné jako výše ale bez emailu a do adresáře mistrů.

---

## 7. Výstupní formát štítků — struktura stránky

### 7.1 Standard / neut — jeden štítek (6 řádků výšky v šabloně)

```
řádek +0:  text1           (např. "CEVA Ground Logistics Slovakia s.r.o.")
řádek +1:  text2           (např. "Papír A4 - CMR")
řádek +2:  text3           (např. "")
řádek +3:  rangeLabel      (např. "Řada:  000001 - 001000") – pouze pokud má řadu
řádek +4:  "Počet:"  "1000 ks"  "A17984"
```

### 7.2 Oriflame — jeden štítek (9 řádků výšky)

```
řádek -1:  "Oriflame Cosmetics S.A."
řádek +0:  text1           (číslo položky, např. "152372.1")
řádek +1:  text2           (popis, např. "Vialky Essenza Man CZ - 157x100mm")
řádek +2:  "Total Units:"  [prázdné]  packSize  "pcs"
řádek +3:  [prázdné]
řádek +4:  =CKODCODE128(řádek+5)   → čárový kód jako CODE128 font
řádek +5:  "(92)text1(37)packSize" → data pro čárový kód
```

> **Poznámka k CODE128:** VBA používá vlastní funkci `CKODCODE128()` a font `CODE128.ttf`. V Node.js nahradit knihovnou `bwip-js`:
> ```typescript
> import bwipjs from 'bwip-js';
> const png = await bwipjs.toBuffer({ bcid: 'code128', text: `(92)${text1}(37)${packSize}` });
> ```

### 7.3 Rozložení na A4 (Standard) — fyzický layout

Z `List1` je šablona `Standard` s layoutem 2×7 nebo 2×8. Na základě parametrů šablony:
- colStart=1, colStep=4, colEnd=6 → 2 sloupce štítků (na pozicích sloupce 1 a 5)
- rowStart=2, rowStep=7, rowEnd=49 → 7 řádků štítků
- Celkem: **14 štítků na A4 stránku**

Každý štítek zabírá buňky `(row, col)` až `(row+5, col+3)` — 6 výšek × 4 šíře.

---

## 8. Oprávnění — kdo může co

Přesný přepis whitelist logiky z **S_901_Kontrola_tiskar** (Legenda!W2:Wn):

| Akce | ZADAVATEL | MISTER | TISKAR | ADMIN |
|------|-----------|--------|--------|-------|
| Vytvořit zakázku | ✓ | ✓ | ✗ | ✓ |
| Zadat pro mailing | ✓ | ✗ | ✗ | ✓ |
| Zadat pro mistry | ✓ | ✗ | ✗ | ✓ |
| Uložit rozpracované | ✓ | ✓ | ✗ | ✓ |
| Tisknout štítek | ✗ | ✓ | ✓ | ✓ |
| Označit Zpracováno | ✗ | ✓ | ✓ | ✓ |
| Správa uživatelů | ✗ | ✗ | ✗ | ✓ |
| Správa šablon | ✗ | ✗ | ✗ | ✓ |

---

## 9. Uložení souborů (`lib/storage.ts`)

Přepis `ChDrive / ChDir / SaveAs / Kill` operací.

### 9.1 Adresářová struktura (mapuje W:\\16_Stitky\\...)

```
STORAGE_ROOT/
  zadane_stitky/
    stitky_pro_Mailing/     ← SUBMITTED zakázky (z Legenda!B19)
    stitky_pro_mistry/      ← SUBMITTED_MISTRI zakázky (z Legenda!B20)
  hotove_stitky/            ← DONE zakázky (podadresář cesty)
  pdfs/                     ← generované PDF soubory
```

### 9.2 API interface

```typescript
export interface StorageService {
  // Uložit zakázku (XLSM → JSON nebo PDF reprezentace)
  saveOrder(filename: string, dir: 'mailing' | 'mistri', data: Buffer): Promise<string>;

  // Přesunout do archivu (Presunuti_po_Zpracovani)
  archiveOrder(filename: string, fromDir: 'mailing' | 'mistri'): Promise<void>;

  // Smazat soubor (Smazani_souboru_*)
  deleteOrder(filename: string, dir: 'mailing' | 'mistri' | 'draft'): Promise<void>;

  // Uložit PDF arch (z S_900)
  savePdf(filename: string, data: Buffer): Promise<string>;
}
```

Implementace: lokální `fs` pro on-premise, nebo AWS S3 pro cloud.

---

## 10. Environmentální proměnné (`.env.example`)

```bash
# Databáze
DATABASE_URL="postgresql://user:pass@localhost:5432/stitky"

# JWT
JWT_SECRET="min-32-chars-secret"
JWT_EXPIRES_IN="8h"

# Email (Nodemailer)
SMTP_HOST="mail.integraf.cz"
SMTP_PORT=25
SMTP_USER=""
SMTP_PASS=""
SMTP_FROM="STITKY <stitky@integraf.cz>"
EMAIL_RECIPIENTS="d.stepan@integraf.cz;m.mateju@integraf.cz;operator@integraf.cz"

# Úložiště souborů
STORAGE_ROOT="W:/16_Stitky"           # nebo "/mnt/stitky" na Linuxu
STORAGE_PROVIDER="local"              # "local" | "s3"

# S3 (pokud STORAGE_PROVIDER=s3)
S3_BUCKET=""
S3_REGION=""
AWS_ACCESS_KEY_ID=""
AWS_SECRET_ACCESS_KEY=""

# App
NEXT_PUBLIC_APP_URL="http://localhost:3000"
NODE_ENV="development"
```

---

## 11. API endpointy (přehled)

| Method | Path | Akce | Auth |
|--------|------|------|------|
| POST | `/api/auth/login` | Login, vrátí JWT | public |
| GET | `/api/orders` | Seznam zakázek (filtr stav, user) | všichni |
| POST | `/api/orders` | Vytvořit zakázku | ZADAVATEL+ |
| GET | `/api/orders/:id` | Detail zakázky | všichni |
| PATCH | `/api/orders/:id` | Aktualizovat zakázku | ZADAVATEL+ |
| POST | `/api/orders/:id/submit` | Zadat do výroby (+ email) | ZADAVATEL+ |
| POST | `/api/orders/:id/submit-mistri` | Zadat pro mistry | ZADAVATEL+ |
| POST | `/api/orders/:id/print/:row` | Tisknout řádek N | TISKAR/MISTER |
| GET | `/api/orders/:id/pdf/:row` | Generovat PDF arch | TISKAR/MISTER |
| POST | `/api/orders/:id/complete` | Zpracováno (+ email + archiv) | TISKAR/MISTER |
| GET | `/api/orders/:id/preview/:row` | Náhled štítků | ZADAVATEL+ |
| GET | `/api/templates` | Seznam šablon | všichni |
| GET | `/api/users` | Seznam uživatelů | ADMIN |
| POST | `/api/users` | Vytvořit uživatele | ADMIN |
| PATCH | `/api/users/:id` | Upravit uživatele/roli | ADMIN |

---

## 12. Seed data

### 12.1 Výchozí šablony (z Legenda)

```typescript
const templates = [
  { key: 'Standard',    sheetName: 'Standard', rowStart: 2, rowStep: 7, rowEnd: 49, colStart: 1, colStep: 4, colEnd: 6 },
  { key: 'Standard IG', sheetName: 'Standard', rowStart: 2, rowStep: 7, rowEnd: 49, colStart: 1, colStep: 4, colEnd: 6 },
  { key: 'Neutrální',   sheetName: 'neut',     rowStart: 2, rowStep: 7, rowEnd: 49, colStart: 1, colStep: 4, colEnd: 6 },
  { key: 'Oriflame',    sheetName: 'Oriflame', rowStart: 2, rowStep: 9, rowEnd: 34, colStart: 1, colStep: 5, colEnd: 9 },
];
```

### 12.2 Výchozí uživatelé (z Legenda!W)

```typescript
const users = [
  { username: 'lubomír.kotrba', role: 'TISKAR' },
  { username: 'd.stepan',       role: 'ADMIN' },
  { username: 'vyrezy',         role: 'TISKAR' },
  { username: 'vyr-geis',       role: 'TISKAR' },
  { username: 'data',           role: 'TISKAR' },
  { username: 'd.riha',         role: 'TISKAR' },
  { username: 'm.zhibo',        role: 'ZADAVATEL' },
  { username: 'j.dyntar',       role: 'ZADAVATEL' },
  { username: 'm.donat',        role: 'ZADAVATEL' },
  { username: 'mistri',         role: 'MISTER' },
  { username: 'm.mateju',       role: 'ADMIN' },
];
```

---

## 13. Testovací případy (unit testy)

### 13.1 `ciselnaRada` — hraniční případy

```typescript
describe('generateLabels', () => {
  test('základní případ: 100000ks, balení 1000, bez řady', () => {
    // od=1, do=100000, packSize=1000 → 100 štítků → 100/14 = 8 stran (Standard)
    const r = generateLabels({ quantity: 100000, packSize: 1000, ... }, standardTemplate, ...);
    expect(r.totalPages).toBe(Math.ceil(100 / 14)); // = 8
  });

  test('leading zeros: rangeFrom="000001", rangeTo="001000"', () => {
    const r = generateLabels({ quantity: 1000, packSize: 1, rangeFrom: '000001', rangeTo: '001000' }, ...);
    expect(r.pages[0][0].rangeLabel).toBe('Řada:  000001 - 000001');
  });

  test('štítek bez číselné řady', () => {
    const r = generateLabels({ quantity: 50, packSize: 50, rangeFrom: null, rangeTo: null }, ...);
    expect(r.pages[0][0].rangeLabel).toBe('');
    expect(r.pages[0][0].pocetKs).toBe('50 ks');
  });

  test('Oriflame: barcodeData formát', () => {
    const r = generateLabels({ text1: '152372.1', packSize: 100, ... }, oriflameTemplate, ...);
    expect(r.pages[0][0].barcodeData).toBe('(92)152372.1(37)100');
  });

  test('přesah na druhou stranu', () => {
    // Standard: 14 štítků/strana, 15 štítků → 2 stránky
    const r = generateLabels({ quantity: 15000, packSize: 1000, ... }, standardTemplate, ...);
    expect(r.pages.length).toBe(2);
    expect(r.pages[0].length).toBe(14);
    expect(r.pages[1].length).toBe(1);
  });
});
```

### 13.2 Validace — hraniční případy

```typescript
describe('orderRowSchema', () => {
  test('množství < balení → chyba', () => {
    const r = labelRowSchema.safeParse({ rowIndex: 1, quantity: '100', packSize: '1000', text1: 'x' });
    expect(r.success).toBe(false);
  });

  test('rozsah neodpovídá množství', () => {
    const r = labelRowSchema.safeParse({ rowIndex: 1, quantity: '100', packSize: '1', text1: 'x', rangeFrom: '1', rangeTo: '200' });
    expect(r.success).toBe(false); // 200-1+1=200 != 100
  });

  test('leading zeros v rangeFrom jsou povoleny', () => {
    const r = labelRowSchema.safeParse({ rowIndex: 1, quantity: '1000', packSize: '1', text1: 'x', rangeFrom: '000001', rangeTo: '001000' });
    expect(r.success).toBe(true);
  });
});
```

---

## 14. Poznámky pro agenta

1. **Šablony jsou komponenty, ne databázové záznamy tiskového layoutu.** Každá šablona (`Standard`, `neut`, `Oriflame`) je samostatná React komponenta s fixním CSS layoutem odpovídajícím fyzické velikosti štítku. Parametry z DB (`rowStart`, `colStep` atd.) se použijí v `generateLabels()`, ne v CSS.

2. **`rangeFrom` a `rangeTo` ukládat jako STRING v DB**, nikoli Int — kvůli zachování leading zeros při zobrazení. Parsovat na Int jen pro výpočty.

3. **Tisk přes `window.print()`** — stránkování řídí CSS `@media print { page-break-after: always }`, ne JavaScript. Každá tisková strana = jeden `<div class="print-page">`.

4. **VBA `CKODCODE128()` funkce** je plná implementace CODE128 (tabulky B a C, checksum). Nahradit `bwip-js` — zavolat s `bcid: 'code128'`.

5. **Validace je sbírková** (VBA shromažďuje VŠECHNY chyby a zobrazí je najednou v MsgBox). Zod `superRefine` umožňuje přidat více issues — UI zobrazí seznam všech chyb najednou.

6. **5 řádků zakázky** (řádky 3–7 v List1) = max 5 různých typů štítků v jedné zakázce. Obvyklý případ je 1 řádek.

7. **`Legenda!B27` (Tisk x PDF)** — v webové verzi nahradit tlačítky "Tisknout" a "Stáhnout PDF" v UI. Stav není třeba ukládat do DB.
