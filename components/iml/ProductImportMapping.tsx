"use client";

import { useEffect, useMemo, useState } from "react";
import { GripVertical, RefreshCw } from "lucide-react";

export const IML_PRODUCT_IMPORT_TARGET_FIELDS = [
  { key: "ig_code", label: "Kód IG (IMLEXport: code / Kód)", required: false },
  { key: "ig_short_name", label: "Zkrácený název (IG)", required: false },
  { key: "client_code", label: "Kód u klienta", required: false },
  { key: "client_name", label: "Název u klienta", required: false },
  { key: "sku", label: "SKU", required: false },
  { key: "customer_name", label: "Zákazník (pro párování)", required: false },
  { key: "product_kind", label: "Druh produktu (iml/etikety)", required: false },
  { key: "requester", label: "Zadavatel", required: false },
  { key: "label_shape_code", label: "Kód tvaru etikety", required: false },
  { key: "product_format", label: "Rozměr/formát (text)", required: false },
  { key: "format_width_mm", label: "Formát š (mm)", required: false },
  { key: "format_height_mm", label: "Formát v (mm)", required: false },
  { key: "die_cut_tool_code", label: "Kód výsekového nástroje", required: false },
  { key: "assembly_code", label: "Kód montáže", required: false },
  { key: "positions_on_sheet", label: "Pozic na archu", required: false },
  { key: "pieces_per_box", label: "Kusů v krabici", required: false },
  { key: "pieces_per_pallet", label: "Kusů na paletě", required: false },
  { key: "foil_type", label: "Druh fólie", required: false },
  { key: "foil_material_id", label: "ID fólie (katalog)", required: false },
  { key: "color_coverage", label: "Barevnost / pokrytí", required: false },
  { key: "color_material_id", label: "ID barvy (katalog)", required: false },
  { key: "paper_material_id", label: "ID papíru (katalog)", required: false },
  { key: "lacquer_material_id", label: "ID laku (katalog)", required: false },
  { key: "print_note", label: "Poznámka k tisku", required: false },
  { key: "ean_code", label: "EAN kód", required: false },
  { key: "production_notes", label: "Výrobní poznámky", required: false },
  { key: "item_status", label: "Stav položky", required: false },
  { key: "approval_status", label: "Stav schválení", required: false },
  { key: "approval_date", label: "Datum schválení (YYYY-MM-DD)", required: false },
  { key: "color_count", label: "Počet barev (1–8)", required: false },
  { key: "print_colors_text", label: "Barvy (souhrn)", required: false },
  { key: "label_type", label: "Etiketa (rezana/s_vysekem)", required: false },
  { key: "has_print_sample", label: "Vzor min. tisku (ano/1)", required: false },
  { key: "has_print_proof", label: "Nátisk (ano/1)", required: false },
] as const;

export type ProductImportMapping = Record<string, number>;

type MappedPreviewColumn = {
  key: string;
  label: string;
  sourceIndex: number;
  sourceHeader: string;
};

function buildMappedPreviewColumns(
  mapping: ProductImportMapping,
  headers: string[]
): MappedPreviewColumn[] {
  const cols: MappedPreviewColumn[] = [];
  for (const field of IML_PRODUCT_IMPORT_TARGET_FIELDS) {
    const idx = mapping[field.key];
    if (typeof idx !== "number" || idx < 0) continue;
    cols.push({
      key: field.key,
      label: field.label,
      sourceIndex: idx,
      sourceHeader: headers[idx] ?? `sloupec ${idx}`,
    });
  }
  return cols;
}

export function ProductImportMappingPanel({
  mode = "full",
  headers,
  rows,
  mapping,
  dragOver,
  draggedCol,
  setDragOver,
  setDraggedCol,
  onDropTarget,
  removeMapping,
}: {
  mode?: "full" | "patch";
  headers: string[];
  rows: string[][];
  mapping: ProductImportMapping;
  dragOver: string | null;
  draggedCol: number | null;
  setDragOver: (v: string | null) => void;
  setDraggedCol: (v: number | null) => void;
  onDropTarget: (fieldKey: string) => void;
  removeMapping: (fieldKey: string) => void;
}) {
  const [previewMode, setPreviewMode] = useState<"mapped" | "source">("mapped");
  const [previewMapping, setPreviewMapping] = useState<ProductImportMapping>(mapping);
  const [previewFlash, setPreviewFlash] = useState(false);

  // Nový soubor / nové hlavičky → náhled podle aktuálního (auto) mapování
  useEffect(() => {
    setPreviewMapping({ ...mapping });
    setPreviewMode("mapped");
    // eslint-disable-next-line react-hooks/exhaustive-deps -- jen při změně hlaviček (nový soubor)
  }, [headers]);

  const mappedColumns = useMemo(
    () => buildMappedPreviewColumns(previewMapping, headers),
    [previewMapping, headers]
  );

  const redrawPreview = () => {
    setPreviewMapping({ ...mapping });
    setPreviewMode("mapped");
    setPreviewFlash(true);
    window.setTimeout(() => setPreviewFlash(false), 700);
  };

  return (
    <>
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h3 className="mb-2 text-sm font-semibold text-gray-700">Mapování sloupců</h3>
        {mode === "patch" ? (
          <p className="mb-4 text-xs text-gray-500">
            Povinné mapování na <strong>Kód IG</strong>. Mapujte jen pole, která chcete doplnit –
            prázdné buňky dané pole u produktu nemění. Auto-map rozpozná české hlavičky (Kód,
            Nástroj číslo, Zákazník…).
          </p>
        ) : (
          <p className="mb-4 text-xs text-gray-500">
            Sloupec <code className="rounded bg-gray-100 px-1">code</code> z IMLEXportu se mapuje na
            Kód IG (podporováno <code className="rounded bg-gray-100 px-1">06-02-001</code> i{" "}
            <code className="rounded bg-gray-100 px-1">498056</code>). Povinné: alespoň Kód IG,
            Název u klienta nebo Zkrácený název.
          </p>
        )}
        <div className="grid gap-6 lg:grid-cols-2">
          <div>
            <p className="mb-2 text-xs font-medium text-gray-500">Sloupce v souboru</p>
            <div className="flex flex-wrap gap-2">
              {headers.map((h, i) => (
                <div
                  key={i}
                  draggable
                  onDragStart={() => setDraggedCol(i)}
                  onDragEnd={() => setDraggedCol(null)}
                  className={`flex cursor-grab items-center gap-1 rounded-lg border px-3 py-2 text-sm ${
                    draggedCol === i
                      ? "border-red-400 bg-red-50 opacity-80"
                      : "border-gray-300 bg-white hover:border-gray-400"
                  }`}
                >
                  <GripVertical className="h-4 w-4 text-gray-400" />
                  <span className="font-medium">{h}</span>
                </div>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-2 text-xs font-medium text-gray-500">Cílová pole</p>
            <div className="max-h-[400px] space-y-2 overflow-y-auto">
              {IML_PRODUCT_IMPORT_TARGET_FIELDS.map((f) => (
                <div
                  key={f.key}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragOver(f.key);
                  }}
                  onDragLeave={() => setDragOver(null)}
                  onDrop={() => onDropTarget(f.key)}
                  className={`flex items-center justify-between rounded-lg border-2 px-3 py-2 ${
                    dragOver === f.key
                      ? "border-red-400 bg-red-50"
                      : mapping[f.key] != null
                        ? "border-green-300 bg-green-50/50"
                        : "border-dashed border-gray-300 bg-gray-50"
                  }`}
                >
                  <span className="text-sm">{f.label}</span>
                  {mapping[f.key] != null ? (
                    <span className="flex items-center gap-1">
                      <span className="rounded bg-green-100 px-2 py-0.5 text-xs text-green-800">
                        {headers[mapping[f.key]]}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeMapping(f.key)}
                        className="text-red-600 hover:text-red-700"
                      >
                        ×
                      </button>
                    </span>
                  ) : (
                    <span className="text-xs text-gray-400">Přetáhněte sloupec</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div
        className={`rounded-xl border bg-white p-6 shadow-sm transition-colors ${
          previewFlash ? "border-violet-400 ring-2 ring-violet-200" : "border-gray-200"
        }`}
      >
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-gray-700">Náhled dat</h3>
            <p className="mt-0.5 text-xs text-gray-500">
              {previewMode === "mapped"
                ? "Sloupce podle aktuálního mapování na cílová pole IML."
                : "Původní sloupce ze souboru (bez mapování)."}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-lg border border-gray-200 p-0.5 text-xs">
              <button
                type="button"
                onClick={() => setPreviewMode("mapped")}
                className={`rounded-md px-2.5 py-1.5 ${
                  previewMode === "mapped"
                    ? "bg-violet-600 text-white"
                    : "text-gray-600 hover:bg-gray-50"
                }`}
              >
                Podle mapování
              </button>
              <button
                type="button"
                onClick={() => setPreviewMode("source")}
                className={`rounded-md px-2.5 py-1.5 ${
                  previewMode === "source"
                    ? "bg-violet-600 text-white"
                    : "text-gray-600 hover:bg-gray-50"
                }`}
              >
                Zdrojové CSV
              </button>
            </div>
            <button
              type="button"
              onClick={redrawPreview}
              className="inline-flex items-center gap-1.5 rounded-lg border border-violet-300 bg-violet-50 px-3 py-1.5 text-sm font-medium text-violet-800 hover:bg-violet-100"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Překreslit náhled
            </button>
          </div>
        </div>

        {previewMode === "mapped" && mappedColumns.length === 0 ? (
          <p className="rounded-lg border border-dashed border-amber-300 bg-amber-50 px-3 py-4 text-sm text-amber-900">
            Zatím není namapované žádné pole. Přetáhněte sloupce na cílová pole a stiskněte{" "}
            <strong>Překreslit náhled</strong>.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  {previewMode === "mapped"
                    ? mappedColumns.map((col) => (
                        <th key={col.key} className="px-3 py-2 text-left font-medium text-gray-700">
                          <span className="block">{col.label}</span>
                          <span className="mt-0.5 block text-[11px] font-normal text-gray-400">
                            ← {col.sourceHeader}
                          </span>
                        </th>
                      ))
                    : headers.map((h, i) => (
                        <th key={i} className="px-3 py-2 text-left font-medium text-gray-700">
                          {h}
                          {Object.values(previewMapping).includes(i) && (
                            <span className="ml-1 text-[10px] font-normal text-green-700">
                              (mapováno)
                            </span>
                          )}
                        </th>
                      ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, ri) => (
                  <tr key={ri} className="border-b border-gray-100">
                    {previewMode === "mapped"
                      ? mappedColumns.map((col) => (
                          <td key={col.key} className="max-w-[220px] truncate px-3 py-2">
                            {row[col.sourceIndex] ?? ""}
                          </td>
                        ))
                      : headers.map((_, ci) => (
                          <td key={ci} className="max-w-[200px] truncate px-3 py-2">
                            {row[ci] ?? ""}
                          </td>
                        ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
