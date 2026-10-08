# Runbook: přechod IGIS → IML (spec v2 §5.2)

## Cíl

Jednorázový / dávkový přesun etiket a metadat ze starého IGISu do APPIntegraf IML bez přepsání již opravených záznamů.

## Před startem

1. Záloha DB `appintegraf` (mysqldump / AMPPS backup).
2. V IGIS nastavit **read-only** přístup pro běžné uživatele (nebo odstávka zápisu).
3. Ověřit migrace Prisma: `npx prisma migrate status` (včetně `iml_shape_*`).
4. Importovat katalog nástrojů: IML → Výseky → Nástroje → Import (`primary_machine` mapovat ze sloupce stroje).

## Postup po zákaznících

1. Exportovat z IGISu dávku jednoho zákazníka (CSV/Excel dle interní šablony).
2. V IML: **Import / Export** → import produktů s mapováním sloupců.
3. Po importu: přehled **Produkty → filtr „Bez tvaru“** (nebo dashboard karta „Bez tvaru“).
4. Filtrovat podle šířka × výška mm → **Přiřadit tvar vybraným položkám**.
5. U tvarů doplnit materiálovou matici (Expedice / Technologie).
6. Opakovat pro další zákazníky.

## Ochrana metadat

- Import patch režim nepřepisuje existující PDF / softproof / barvy, pokud to šablona zakazuje.
- Preferovat párování přes `ig_code` / SKU, ne slepé inserty.

## Po migraci

- IGIS ponechat read-only do potvrzení provozu.
- Cicero: sledovat výkon (mimo kód aplikace; indexy / síť).
- Dokumentovat zbývající produkty bez `shape_id` a domluvit termín dočištění.

## Související

- [IML_VYSEKY_LEGACY_MAPPING.md](IML_VYSEKY_LEGACY_MAPPING.md)
- [vyvojarska-specifikace-iml-v2.md](vyvojarska-specifikace-iml-v2.md)
