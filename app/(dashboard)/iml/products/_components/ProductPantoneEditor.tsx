"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { GripVertical, Plus, Trash2 } from "lucide-react";
import { consumptionKg } from "@/lib/iml-color-consumption";
import { normalizePantoneCode } from "@/lib/iml-pantone";

/**
 * Jeden řádek barevnosti produktu.
 * - `pantone_id`: FK na iml_pantone_colors (vyplněno u řádku z číselníku)
 * - `code`: vždy normalizovaný kód (zdroj pravdy pro UI / porovnání)
 * - `coverage_pct`: 0–100 (uložené jako Decimal na serveru)
 */
export type ProductColorRow = {
  pantone_id: number | null;
  code: string;
  name?: string | null;
  hex?: string | null;
  coverage_pct: string; // držíme jako string pro plynulé psaní
  sort_order?: number;
};

type PantoneCatalogItem = {
  id: number;
  code: string;
  name: string | null;
  hex: string | null;
  is_active: boolean;
};

type Props = {
  colors: ProductColorRow[];
  onChange: (rows: ProductColorRow[]) => void;
  labelsPerSheet: number | null;
};

/** Referenční náklad pro live preview spotřeby. */
const REFERENCE_PIECES = 10_000;

/**
 * Editor Pantone barev produktu.
 *
 * Funkce:
 * - Combobox s autocomplete z číselníku (iml_pantone_colors) – dropdown
 *   zobrazuje shody + volbu „Vytvořit kartu" přímo z editoru (POST /api/iml/pantone-colors).
 * - Enter v comboboxu → focus na pokrytí.
 * - Live preview spotřeby na ref. nákladu (REFERENCE_PIECES) – pokud chybí
 *   `labels_per_sheet`, ukáže se žlutý hint místo čísla.
 */
export default function ProductPantoneEditor({ colors, onChange, labelsPerSheet }: Props) {
  const [catalog, setCatalog] = useState<PantoneCatalogItem[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(true);

  const loadCatalog = useCallback(async () => {
    try {
      const r = await fetch("/api/iml/pantone-colors");
      const data = await r.json();
      setCatalog(data.colors ?? []);
    } catch {
      // tichý fail – uživatel stále může psát ručně a onBlur/validate to zachytí
    } finally {
      setCatalogLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCatalog();
  }, [loadCatalog]);

  /**
   * Vytvoří novou Pantone kartu v číselníku. Vrací nově vytvořený záznam,
   * nebo `null` (API vrátilo chybu – např. duplicita, neplatný kód).
   */
  const createInCatalog = useCallback(
    async (code: string): Promise<PantoneCatalogItem | null> => {
      try {
        const r = await fetch("/api/iml/pantone-colors", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code }),
        });
        const data = await r.json().catch(() => ({}));
        if (!r.ok || !data.color) return null;
        // optimistický update katalogu, ať to je hned k dispozici i v ostatních řádcích
        setCatalog((prev) => {
          const without = prev.filter((p) => p.id !== data.color.id);
          return [...without, data.color].sort((a, b) => a.code.localeCompare(b.code));
        });
        return data.color as PantoneCatalogItem;
      } catch {
        return null;
      }
    },
    []
  );

  const add = () => {
    const next: ProductColorRow = {
      pantone_id: null,
      code: "",
      coverage_pct: "",
      sort_order: colors.length,
    };
    onChange([...colors, next]);
  };

  const remove = (i: number) => {
    const next = colors.filter((_, idx) => idx !== i).map((r, idx) => ({ ...r, sort_order: idx }));
    onChange(next);
  };

  const update = (i: number, patch: Partial<ProductColorRow>) => {
    const next = colors.map((r, idx) => (idx === i ? { ...r, ...patch } : r));
    onChange(next);
  };

  const totalCoverage = useMemo(
    () =>
      colors.reduce((sum, r) => {
        const v = parseFloat(r.coverage_pct);
        return sum + (Number.isFinite(v) ? v : 0);
      }, 0),
    [colors]
  );

  return (
    <div className="space-y-3">
      {colors.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-6 text-center text-sm text-gray-500">
          Zatím nejsou zadány žádné barvy. Klikněte na <strong>„+ Přidat barvu"</strong>.
        </div>
      ) : (
        <div className="overflow-visible rounded-xl border border-gray-200 bg-white">
          <div className="grid grid-cols-[auto,2fr,2fr,1fr,1fr,auto] items-center gap-2 bg-gray-50 px-3 py-2 text-xs font-medium text-gray-600">
            <span />
            <span>Pantone kód</span>
            <span>Název (z číselníku)</span>
            <span className="text-right">Pokrytí %</span>
            <span className="text-right">
              Spotřeba @ {REFERENCE_PIECES.toLocaleString("cs-CZ")} ks
            </span>
            <span />
          </div>
          {colors.map((row, i) => (
            <ColorRowEditor
              key={i}
              index={i}
              row={row}
              catalog={catalog}
              catalogLoading={catalogLoading}
              onCreateInCatalog={createInCatalog}
              labelsPerSheet={labelsPerSheet}
              onChange={(patch) => update(i, patch)}
              onRemove={() => remove(i)}
            />
          ))}
        </div>
      )}

      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={add}
          className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
        >
          <Plus className="h-4 w-4" />
          Přidat barvu
        </button>
        {colors.length > 0 && (
          <div className="text-xs text-gray-500">
            Součet pokrytí:{" "}
            <span
              className={
                totalCoverage > 100 ? "font-semibold text-amber-700" : "font-medium text-gray-700"
              }
            >
              {totalCoverage.toFixed(2)} %
            </span>
            {totalCoverage > 100 && (
              <span className="ml-2 text-amber-700">
                (nadlimitně – zkontrolujte, že jsou barvy opravdu takto vrstvené)
              </span>
            )}
          </div>
        )}
      </div>

      {!labelsPerSheet && colors.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
          Doplňte <strong>Počet etiket na tiskový arch</strong> v záložce <em>Výseky</em>, aby bylo
          možné zobrazit orientační spotřebu barvy.
        </div>
      )}
    </div>
  );
}

function ColorRowEditor({
  index,
  row,
  catalog,
  catalogLoading,
  onCreateInCatalog,
  labelsPerSheet,
  onChange,
  onRemove,
}: {
  index: number;
  row: ProductColorRow;
  catalog: PantoneCatalogItem[];
  catalogLoading: boolean;
  onCreateInCatalog: (code: string) => Promise<PantoneCatalogItem | null>;
  labelsPerSheet: number | null;
  onChange: (patch: Partial<ProductColorRow>) => void;
  onRemove: () => void;
}) {
  const coverageInputRef = useRef<HTMLInputElement>(null);

  const coverageNum = parseFloat(row.coverage_pct);
  const kg =
    Number.isFinite(coverageNum) && coverageNum > 0
      ? consumptionKg(REFERENCE_PIECES, labelsPerSheet ?? null, coverageNum)
      : null;

  const hasCode = row.code.trim() !== "";
  const hasCoverage = row.coverage_pct !== "" && Number.isFinite(coverageNum);
  const isPartial = (hasCode || hasCoverage) && !(hasCode && hasCoverage);
  const codeInvalid = isPartial && !hasCode;
  const coverageInvalid = isPartial && !hasCoverage;

  return (
    <div
      className={
        "grid grid-cols-[auto,2fr,2fr,1fr,1fr,auto] items-center gap-2 border-t px-3 py-2 " +
        (isPartial ? "border-amber-200 bg-amber-50/50" : "border-gray-100")
      }
    >
      <span
        className="flex h-6 w-6 items-center justify-center text-gray-300"
        title={`#${index + 1}`}
      >
        <GripVertical className="h-4 w-4" />
      </span>

      <PantoneCombobox
        row={row}
        invalid={codeInvalid}
        catalog={catalog}
        catalogLoading={catalogLoading}
        onInput={(raw) =>
          onChange({
            code: raw,
            pantone_id: null,
            name: null,
            hex: null,
          })
        }
        onSelect={(p) =>
          onChange({
            pantone_id: p.id,
            code: p.code,
            name: p.name,
            hex: p.hex,
          })
        }
        onCreate={async (normalized) => {
          const created = await onCreateInCatalog(normalized);
          if (created) {
            onChange({
              pantone_id: created.id,
              code: created.code,
              name: created.name,
              hex: created.hex,
            });
          } else {
            onChange({ code: normalized, pantone_id: null });
          }
        }}
        onEnterToCoverage={() => coverageInputRef.current?.focus()}
      />

      <div className="text-sm text-gray-700">
        {row.name ? row.name : <span className="text-gray-400">—</span>}
      </div>

      <div>
        <input
          ref={coverageInputRef}
          type="number"
          min={0}
          max={100}
          step={0.1}
          value={row.coverage_pct}
          onChange={(e) => onChange({ coverage_pct: e.target.value })}
          placeholder="50"
          className={
            "w-full rounded-lg border px-2 py-1 text-right text-sm " +
            (coverageInvalid ? "border-amber-400 bg-amber-50" : "border-gray-300")
          }
          title={coverageInvalid ? "Doplňte pokrytí v %" : undefined}
        />
      </div>

      <div className="text-right text-sm tabular-nums">
        {kg != null ? (
          <span className="font-medium text-gray-900">{kg.toFixed(4)} kg</span>
        ) : (
          <span className="text-xs text-gray-400">
            {labelsPerSheet ? "—" : "doplňte TA"}
          </span>
        )}
      </div>

      <button
        type="button"
        onClick={onRemove}
        className="rounded p-1 text-red-600 hover:bg-red-50"
        title="Odebrat řádek"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
}

/**
 * Combobox pro výběr Pantone kódu:
 * - onFocus / onChange otevírá dropdown s filtrovanými položkami z číselníku
 * - kliknutí na položku vyplní pantone_id + name + hex
 * - pokud uživatelův text neodpovídá žádné kartě, zobrazí se tlačítko
 *   „Vytvořit kartu 'P 485 C'" které zavolá POST /api/iml/pantone-colors
 *   a následně ji rovnou naváže na řádek.
 */
function PantoneCombobox({
  row,
  invalid,
  catalog,
  catalogLoading,
  onInput,
  onSelect,
  onCreate,
  onEnterToCoverage,
}: {
  row: ProductColorRow;
  invalid?: boolean;
  catalog: PantoneCatalogItem[];
  catalogLoading: boolean;
  onInput: (raw: string) => void;
  onSelect: (p: PantoneCatalogItem) => void;
  onCreate: (normalized: string) => void | Promise<void>;
  onEnterToCoverage: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const normalized = normalizePantoneCode(row.code);
  const query = row.code.trim().toUpperCase();

  const matches = useMemo(() => {
    const active = catalog.filter((p) => p.is_active);
    if (!query) return active.slice(0, 50);
    return active
      .filter(
        (p) => p.code.includes(query) || (p.name ?? "").toUpperCase().includes(query)
      )
      .slice(0, 50);
  }, [query, catalog]);

  const exactMatch = matches.find((p) => p.code === normalized) ?? null;
  const canCreate = normalized.length > 0 && !exactMatch;

  // Resetuj zvýraznění při změně seznamu
  useEffect(() => {
    setHighlight(0);
  }, [matches.length, canCreate]);

  // Zavření při kliknutí mimo
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const totalOptions = matches.length + (canCreate ? 1 : 0);

  const handleCreate = async () => {
    if (!normalized) return;
    setCreating(true);
    try {
      await onCreate(normalized);
    } finally {
      setCreating(false);
      setOpen(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setHighlight((h) => Math.min(totalOptions - 1, h + 1));
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(0, h - 1));
      return;
    }
    if (e.key === "Escape") {
      setOpen(false);
      return;
    }
    if (e.key === "Enter") {
      // Enter = potvrď výběr, nebo přeskoč do pole Pokrytí
      if (open && totalOptions > 0) {
        e.preventDefault();
        if (highlight < matches.length) {
          const p = matches[highlight];
          if (p) {
            onSelect(p);
            setOpen(false);
            onEnterToCoverage();
          }
        } else if (canCreate) {
          e.preventDefault();
          void handleCreate().then(onEnterToCoverage);
        }
      } else {
        e.preventDefault();
        onEnterToCoverage();
      }
      return;
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <div className="flex items-center gap-2">
        {row.hex && /^#[0-9A-Fa-f]{6}$/.test(row.hex) && (
          <span
            className="inline-block h-5 w-5 shrink-0 rounded border border-gray-300"
            style={{ backgroundColor: row.hex }}
            title={row.hex}
          />
        )}
        <input
          type="text"
          value={row.code}
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            onInput(e.target.value);
            setOpen(true);
          }}
          onBlur={(e) => {
            // Normalizuj při opuštění pole (jen pokud uživatel nic nevybral z dropdownu).
            const norm = normalizePantoneCode(e.target.value);
            if (norm !== e.target.value) onInput(norm);
          }}
          onKeyDown={handleKeyDown}
          placeholder="začněte psát P 485…"
          className={
            "w-full rounded-lg border px-2 py-1 font-mono text-sm " +
            (invalid ? "border-amber-400 bg-amber-50" : "border-gray-300")
          }
          title={invalid ? "Doplňte Pantone kód" : undefined}
        />
      </div>

      {open && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-64 overflow-auto rounded-lg border border-gray-200 bg-white shadow-lg">
          {catalogLoading && matches.length === 0 && (
            <div className="px-3 py-2 text-xs text-gray-500">Načítám číselník…</div>
          )}

          {!catalogLoading && matches.length === 0 && !canCreate && (
            <div className="px-3 py-2 text-xs text-gray-500">Žádná shoda v číselníku</div>
          )}

          {matches.map((p, idx) => (
            <button
              key={p.id}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                onSelect(p);
                setOpen(false);
                onEnterToCoverage();
              }}
              onMouseEnter={() => setHighlight(idx)}
              className={
                "flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm " +
                (highlight === idx ? "bg-red-50" : "hover:bg-gray-50")
              }
            >
              {p.hex && /^#[0-9A-Fa-f]{6}$/.test(p.hex) ? (
                <span
                  className="inline-block h-4 w-4 shrink-0 rounded border border-gray-200"
                  style={{ backgroundColor: p.hex }}
                />
              ) : (
                <span className="inline-block h-4 w-4 shrink-0 rounded border border-dashed border-gray-200" />
              )}
              <span className="font-mono">{p.code}</span>
              {p.name && (
                <span className="truncate text-gray-500">— {p.name}</span>
              )}
            </button>
          ))}

          {canCreate && (
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={handleCreate}
              onMouseEnter={() => setHighlight(matches.length)}
              disabled={creating}
              className={
                "flex w-full items-center gap-2 border-t border-gray-100 bg-gray-50 px-3 py-1.5 text-left text-sm font-medium text-red-700 " +
                (highlight === matches.length ? "bg-red-100" : "hover:bg-red-50") +
                " disabled:opacity-50"
              }
              title="Vytvoří novou Pantone kartu v číselníku a naváže ji na tento řádek."
            >
              <Plus className="h-3.5 w-3.5" />
              {creating
                ? "Vytvářím…"
                : `Vytvořit kartu „${normalized}" v číselníku`}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
