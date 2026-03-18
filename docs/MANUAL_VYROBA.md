# Uživatelský manuál – Modul Výroba

Modul **Výroba** slouží k řízení výroby a balení loterních produktů (jízdenky ČD, stírací losy Sazka, kotouče). Nahrazuje desktopovou aplikaci IG52.

---

## 1. Přehled obrazovek

| Obrazovka | Cesta | Účel |
|-----------|-------|------|
| Dashboard | `/vyroba` | Výběr typu produktu (JOB) |
| Parametry | `/vyroba/[job]` | Nastavení série, počtu ks, prvního čísla |
| Generování | `/vyroba/generovani/[job]` | Spuštění generování dat pro tiskárny |
| Kontrola | `/vyroba/kontrola/[job]` | Výhoz, kontrola balení, protokoly |
| Nastavení | `/vyroba/nastaveni` | ADRESA, konfigurace JOB, zaměstnanci |

---

## 2. Typy produktů (JOB)

| JOB | Popis |
|-----|-------|
| CD_POP | Jízdní doklady POP |
| CD_POP_NEXGO | Jízdní doklady NEXGO |
| CD_Vnitro | Vnitřní jízdenky ČD |
| CD_Validator | Validační jízdenky |
| DPB_AVJ | Kotouče |
| IGT_Sazka | Stírací losy Sazka |

---

## 3. Základní tok práce

### 3.1 Nastavení ADRESA

1. Přejděte do **Nastavení** (`/vyroba/nastaveni`)
2. Do pole **ADRESA** zadejte kořenovou cestu pro výstupy (např. `D:\Sazka\A17144`)
3. Klikněte na **Uložit**

### 3.2 Parametry výroby

1. Na dashboardu vyberte typ produktu (JOB)
2. Nastavte **série** (XB, XC, XD, …), **počet ks v krabici**, **první číslo jízdenky**
3. Pro IGT_Sazka: zadejte **číslo zakázky**

### 3.3 Generování

1. Přejděte na **Generování** z parametrů
2. Zadejte počet ks k vygenerování
3. Klikněte na **Generovat**
4. Data se uloží do `[ADRESA]/TISK/[JOB]/`

### 3.4 Kontrola a výhoz

1. Přejděte na **Kontrola**
2. Zkontrolujte čísla v gridu (Od, Do, ks)
3. Vyberte své **jméno** z dropdownu (zobrazují se jen uživatelé s přístupem k modulu Výroba)
4. Zaškrtněte řádky k výhozu
5. Klikněte na **OK** pro provedení výhozu
6. Při plné krabici se automaticky otevře PDF protokol

**Navigace čísel:**
- `‹` `›` – posun o 1
- `«` `»` – posun o 10
- `«‹` `»›` – posun o 100
- `««` `»»` – posun o 1000

**Turbo** – při zaškrtnutí provede výhoz za celou krabici najednou.

### 3.5 Protokoly

- **Protokol** (CD/DPB) – ruční generování balného listu + štítku
- **Sestava** (IGT) – TXT pro jehličkovou tiskárnu
- **Paleta** (IGT) – PDF paletového listu

---

## 4. Export a import TXT

- **Export TXT** – stáhne aktuální stav jako TXT (pro ruční opravu v externím editoru)
- **Import TXT** – nahraje TXT a přepíše stav v databázi

Formát řádku: `Ks|Serie|Do|Od`

---

## 5. Oprava čísel

1. Klikněte na **Opravit**
2. Upravte čísla Od, Do nebo ks v gridu
3. Klikněte na **Uložit opravu**

---

## 6. Nastavení zaměstnanců

V **Nastavení** lze spravovat zaměstnance (baliče). Tato funkce je určena pro starší workflow – v kontrole se nyní vybírá z **uživatelů aplikace s přístupem k modulu Výroba**.

---

## 7. Řešení problémů

| Problém | Řešení |
|---------|--------|
| Nevidím modul Výroba | Kontaktujte administrátora – potřebujete přiřadit roli s přístupem k modulu Výroba |
| Dropdown „Vyber jméno“ je prázdný | Žádný uživatel nemá přístup k modulu Výroba – přidejte přístup v rolích |
| Chyba při generování | Zkontrolujte ADRESA – cesta musí existovat a být zapisovatelná |
| Protokol se neotevře | Zkontrolujte, zda prohlížeč neblokuje automatické otevření PDF |
