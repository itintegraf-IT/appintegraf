# Mapování legacy výseků → tříúrovňový model

## Tabulky

| Legacy (`iml_die_cuts`) | Nový model |
|-------------------------|------------|
| `label_shape_code` | `iml_shape_catalog.shape_code` |
| `die_cut_format` / rozměry ve formátu text | `width_mm` × `height_mm` (parsovat pokud možné) |
| `internal_name` | `iml_shape_catalog.internal_note` |
| `die_cut_tool_code` | `iml_tool_catalog.tool_code_orig` (a případně `tool_code_new`) |
| `primary_machine` (volný text) | `iml_tool_catalog.technology` (ENUM přes mapovací tabulku) |
| `assembly_code` | `iml_imposition_catalog.imposition_code` |
| `positions_on_sheet` / `labels_per_sheet` | `iml_imposition_catalog.positions_count` |
| `pieces_per_box` / `pieces_per_pallet` / `box_type_id` | **v2:** `iml_shape_material_packaging` u tvaru; sync na produkt |
| váhy 50g/60g na nástroji | **v2:** řádky matice `EUP50` / `EUP60` u tvaru |
| — | `iml_shape_customer_assignment` (multiselect zákazníků u tvaru) |

## Produkt

| Legacy | Nový |
|--------|------|
| `die_cut_id` | dočasný bridge; preferovat `shape_id` + `selected_tool_id` + `selected_imposition_id` |
| `label_shape_code`, `die_cut_tool_code`, `assembly_code`, … | denormalizace pro Cicero/XML — sync při změně nových FK |
| — | `raw_data_width_mm` / `raw_data_height_mm` / `colors_spec` (Fénix) |

## Makety / grafika

| Pole | Poznámka |
|------|----------|
| `makety.shape_id` | Povinné před `apply-product-draft` do IML |
| `makety.die_cut_id` | Legacy bridge (volitelné) |

## Oprávnění (module_access)

| Role | Položky |
|------|---------|
| Technologie | `iml` write + `iml.shapes` / `iml.tools` (nebo plný `iml.admin`) |
| Prepress | `iml.impositions` (+ read IML) |
| Expedice | `iml.packing` (matice u tvaru + balení na produktu) |
| Admin | `iml.admin` — vše |

## Provoz

- IGIS migrace: [IML_IGIS_MIGRATION_RUNBOOK.md](IML_IGIS_MIGRATION_RUNBOOK.md)
- Produkty bez tvaru: dashboard IML → karta „Bez tvaru“ / `?missing_shape=1`
