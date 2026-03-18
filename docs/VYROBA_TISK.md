# Řešení tisku – Modul Výroba

Modul Výroba generuje výstupy pro tisk. Původní IG52 používala `win32print` a EPSON FX-890. V Next.js aplikaci jsou k dispozici následující možnosti.

---

## 1. Aktuální podpora

### 1.1 PDF (balné listy, štítky, paletové listy)

- **Generování:** Automaticky při výhozu (CD) nebo přes tlačítka Protokol/Paleta
- **Výstup:** Stažení PDF do prohlížeče
- **Tisk:** Uživatel tiskne ručně (Ctrl+P nebo kontextová nabídka → Tisk)

### 1.2 TXT (inkjety – jehličková tiskárna)

- **Generování:** Tlačítko „Sestava“ v kontrole IGT_Sazka
- **Výstup:** Stažení souboru `.txt`
- **Formát:** Kompatibilní s EPSON FX-890 (ESC/P)

---

## 2. Možnosti tisku

### Možnost A: Ruční tisk (aktuálně)

1. Uživatel stáhne PDF nebo TXT
2. Otevře soubor a vytiskne (Ctrl+P)
3. Pro TXT: otevření v textovém editoru a tisk na jehličkovou tiskárnu

### Možnost B: Cloud Print API

- Pokud je k dispozici Google Cloud Print nebo podobná služba
- Vyžaduje integraci na straně klienta nebo backendu

### Možnost C: Backend tisková služba

- Samostatný proces na Windows serveru s přístupem k tiskárně
- Aplikace by odesílala soubory do fronty této služby
- Služba by tiskla přes `win32print` nebo nativní API

### Možnost D: Lokální tisková služba

- Malá desktopová aplikace (Electron/Tauri) běžící na pracovní stanici
- Přijímá URL nebo soubor a tiskne na lokální tiskárnu
- Webová aplikace by volala lokální endpoint (např. `http://localhost:9999/print`)

---

## 3. Doporučení pro nasazení

| Scénář | Doporučení |
|--------|------------|
| Malý počet tiskáren, občasný tisk | Ruční tisk (A) |
| Častý tisk PDF na síťové tiskárně | Nastavit výchozí tiskárnu v prohlížeči |
| Jehličková tiskárna EPSON FX | Stažení TXT, tisk přes Notepad nebo speciální tiskový nástroj |
| Plná automatizace | Backend služba (C) nebo lokální agent (D) |

---

## 4. Formát TXT pro EPSON FX

Soubor generovaný tlačítkem „Sestava“ (IGT) má formát:

```
      [číslo krabice]                    5,40 kg
      [od čísla]
      [do čísla]

      [série]

      [řádky Od-Do s počty]
                                    [množství]                    [celkem]
```

Řádky jsou zarovnány mezerami pro správnou pozici na štítku. Tiskárna EPSON FX-890 s fixní šířkou písma zobrazí text na správných pozicích.
