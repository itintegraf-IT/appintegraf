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
 * - Dynamické řádky (přidat / odebrat)
 * - onBlur kódu → volání /api/iml/pantone-colors/validate (normalizace + "exists?")
 * - Pokud kód v číselníku není, zobrazí se tlačítko „Vytvořit novou kartu" (auto_create=true
 *   se nastavuje až při save produktu)
 * - Live preview spotřeby na ref. nákladu (REFERENCE_PIECES)
 *   – pokud chybí labels_per_sheet, místo čísla hint „Doplňte etiket/TA…"
 */
export default function ProductPantoneEditor({ colors, onChange, labelsPerSheet }: Props) {
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
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
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
  labelsPerSheet,
  onChange,
  onRemove,
}: {
  index: number;
  row: ProductColorRow;
  labelsPerSheet: number | null;
  onChange: (patch: Partial<ProductColorRow>) => void;
  onRemove: () => void;
}) {
  const [validating, setValidating] = useState(false);
  const [missing, setMissing] = useState(false);
  const [error, setError] = useState("");
  const coverageInputRef = useRef<HTMLInputElement>(null);

  const runValidate = useCallback(async (raw: string) => {
    const normalized = normalizePantoneCode(raw);
    if (!normalized) {
      onChange({ code: "", pantone_id: null, name: null, hex: null });
      setMissing(false);
      setError("");
      return;
    }
    setValidating(true);
    setError("");
    try {
      const r = await fetch("/api/iml/pantone-colors/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: normalized }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        setError(data.error ?? "Chyba validace");
        onChange({ code: normalized, pantone_id: null, name: null, hex: null });
        return;
      }
      onChange({
        code: data.normalized,
        pantone_id: data.id,
        name: data.color?.name ?? null,
        hex: data.color?.hex ?? null,
      });
      setMissing(!data.exists);
    } catch {
      setError("Chyba validace");
    } finally {
      setValidating(false);
    }
  }, [onChange]);

  useEffect(() => {
    // Při prvním mountu (např. při editaci) nepropočítávat znovu validaci – máme už pantone_id.
    // Tohle nemusíme nic dělat, protože initial data přichází kompletní.
  }, []);

  const coverageNum = parseFloat(row.coverage_pct);
  const kg =
    Number.isFinite(coverageNum) && coverageNum > 0
      ? consumptionKg(REFERENCE_PIECES, labelsPerSheet ?? null, coverageNum)
      : null;

  return (
    <div className="grid grid-cols-[auto,2fr,2fr,1fr,1fr,auto] items-center gap-2 border-t border-gray-100 px-3 py-2">
      <span className="flex h-6 w-6 items-center justify-center text-gray-300" title={`#${index + 1}`}>
        <GripVertical className="h-4 w-4" />
      </span>

      <div>
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
            onChange={(e) => onChange({ code: e.target.value })}
            onBlur={(e) => {
              const norm = normalizePantoneCode(e.target.value);
              if (norm !== e.target.value) onChange({ code: norm });
              runValidate(norm);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                coverageInputRef.current?.focus();
              }
            }}
            placeholder="P 485 C"
            className="w-full rounded-lg border border-gray-300 px-2 py-1 font-mono text-sm"
          />
        </div>
        {error && <p className="mt-0.5 text-xs text-red-600">{error}</p>}
        {missing && !error && (
          <p className="mt-0.5 text-xs text-amber-700">
            Není v číselníku – vytvoří se při uložení produktu.
          </p>
        )}
        {validating && <p className="mt-0.5 text-xs text-gray-400">Ověřuji…</p>}
      </div>

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
          className="w-full rounded-lg border border-gray-300 px-2 py-1 text-right text-sm"
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
