# IML – katalog výseků

Návod k vyplnění tvarů, nástrojů a montáží. Vstupní bod: **[/iml/vyseky](/iml/vyseky)**.

## Postup vyplnění (1–5)

Vyplňujte v tomto pořadí — každý krok potřebuje data z předchozího:

| Krok | Co | Cesta | Poznámka |
|------|-----|--------|----------|
| 1 | **Tvary** | `/iml/shapes` | Kód a rozměry etikety (Š × V) |
| 2 | **Nástroje** | `/iml/tools` | Železo / planžeta (u řezání lze nástroj u montáže vynechat) |
| 3 | **Vazby** | `/iml/shapes` → vazby | PRIMARY / ALT přiřazení nástroje k tvaru |
| 4 | **Montáže** | `/iml/impositions` | Formát archu, zařízení, užitky, primární montáž |
| 5 | **Náhledy** | detail tvaru | Výkresy / PDF u tvaru |

Stejná očíslovaná navigace je i na stránkách tvarů, nástrojů a montáží.

## Montáže

- **Hlavička:** formát archu, tiskový stroj, typ výseku / zařízení
- **Užitky:** tabulka pozic / užitků na archu
- **Řezání:** montáž bez výsekového nástroje (řezání místo železa)
- Vazba na **Technologie** (rozkresy) a společné stroje
- Z detailu tvaru lze přejít na související montáže

## Výseková zařízení (Technologie + IML)

V číselníku Technologií / IML jsou mimo jiné:

- **Příklop**
- **Řezačka**

Hodnoty se používají u montáží a evidence výseku.

## Produkty

Na produktu (záložka Výseky) vyberte **tvar** — systém dopočítá / nabídne PRIMARY nástroj a výchozí montáž podle katalogu. Alternativní nástroj se zobrazuje v seznamu produktů, pokud je u tvaru nastaven.

## Hromadné akce

Z hubu `/iml/vyseky`:

- import tvarů
- resync denormalizovaných polí na produktech po změně katalogu
