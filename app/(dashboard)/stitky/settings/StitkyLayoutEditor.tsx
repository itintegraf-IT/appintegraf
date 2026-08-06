"use client";

import { useEffect, useMemo, useState } from "react";
import { LabelPreviewGrid } from "../_components/LabelPreviewGrid";
import type { LabelCell } from "@/lib/stitky/ciselna-rada";
import { getGridSpec, type LabelGridOverridesMap } from "@/lib/stitky/label-layout";
import {
  parseLabelGridOverrides,
  serializeLabelGridOverrides,
} from "@/lib/stitky/label-grid-overrides";

const LAYOUT_OPTIONS = [
  { key: "standard", label: "Standard" },
  { key: "neut", label: "Neutrální" },
  { key: "oriflame", label: "Oriflame" },
] as const;

function sampleCell(componentKey: string): LabelCell {
  if (componentKey === "oriflame") {
    return {
      text1: "Vzorový produkt",
      text2: "REF-12345",
      text3: "",
      rangeLabel: "",
      pocetKs: "100 ks",
      zakazka: "A12345",
      oriflameHeader: "Oriflame",
      totalUnitsLabel: "Total units:",
      totalUnitsValue: "100",
      totalUnitsPcs: "pcs",
      barcodeData: "1234567890123",
    };
  }
  return {
    text1: "Vzorový text 1",
    text2: "Vzorový text 2",
    text3: "Volitelný řádek",
    rangeLabel: "0001 – 0100",
    pocetKs: "100 ks",
    zakazka: "A12345",
  };
}

function buildSamplePages(componentKey: string, overrides: LabelGridOverridesMap): LabelCell[][] {
  const spec = getGridSpec(componentKey, overrides);
  const count = spec.cols * spec.rows;
  const cell = sampleCell(componentKey);
  return [Array.from({ length: count }, () => ({ ...cell }))];
}

type PartialOverride = {
  pageMarginMm: number;
  colGapMm: number;
  rowGapMm: number;
};

function getOverrideForKey(map: LabelGridOverridesMap, key: string): PartialOverride {
  const spec = getGridSpec(key, map);
  return {
    pageMarginMm: spec.pageMarginMm,
    colGapMm: spec.colGapMm,
    rowGapMm: spec.rowGapMm,
  };
}

export function StitkyLayoutEditor() {
  const [overrides, setOverrides] = useState<LabelGridOverridesMap>({});
  const [selectedKey, setSelectedKey] = useState<string>("standard");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/stitky/settings")
      .then((r) => r.json())
      .then((d) => {
        const raw = d.settings?.label_grid_overrides;
        if (raw) {
          try {
            setOverrides(parseLabelGridOverrides(JSON.parse(raw)));
          } catch {
            setOverrides({});
          }
        }
      })
      .catch(() => setOverrides({}));
  }, []);

  const current = useMemo(
    () => getOverrideForKey(overrides, selectedKey),
    [overrides, selectedKey]
  );

  const setField = (field: keyof PartialOverride, value: number) => {
    setOverrides((prev) => ({
      ...prev,
      [selectedKey]: {
        ...prev[selectedKey],
        [field]: value,
      },
    }));
  };

  const resetKey = () => {
    setOverrides((prev) => {
      const next = { ...prev };
      delete next[selectedKey];
      return next;
    });
  };

  const save = async () => {
    setBusy(true);
    setMsg(null);
    setError(null);
    try {
      const res = await fetch("/api/stitky/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label_grid_overrides: serializeLabelGridOverrides(overrides),
        }),
      });
      if (!res.ok) throw new Error("Uložení selhalo");
      setMsg("Uloženo");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Chyba");
    } finally {
      setBusy(false);
    }
  };

  const samplePages = useMemo(
    () => buildSamplePages(selectedKey, overrides),
    [selectedKey, overrides]
  );

  return (
    <div id="layout-stitky" className="rounded-xl border border-gray-200 bg-white p-6">
      <h2 className="mb-2 text-lg font-semibold text-gray-900">Layout výrobních štítků</h2>
      <p className="mb-4 text-sm text-gray-600">
        Doladění okrajů a mezer mřížky na A4. Změny se projeví v náhledu i PDF tisku.
      </p>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-800">
          {error}
        </div>
      )}
      {msg && (
        <div className="mb-4 rounded-lg border border-green-200 bg-green-50 px-4 py-2 text-sm text-green-800">
          {msg}
        </div>
      )}

      <label className="mb-4 block max-w-xs text-sm">
        Typ layoutu
        <select
          className="mt-1 w-full rounded border border-gray-300 px-3 py-2"
          value={selectedKey}
          onChange={(e) => setSelectedKey(e.target.value)}
        >
          {LAYOUT_OPTIONS.map((o) => (
            <option key={o.key} value={o.key}>
              {o.label}
            </option>
          ))}
        </select>
      </label>

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        {(
          [
            ["pageMarginMm", "Okraj stránky"],
            ["colGapMm", "Mezera sloupců"],
            ["rowGapMm", "Mezera řádků"],
          ] as const
        ).map(([field, label]) => (
          <label key={field} className="block text-sm">
            {label} (mm)
            <div className="mt-1 flex items-center gap-2">
              <button
                type="button"
                className="rounded border border-gray-300 px-2 py-1 hover:bg-gray-50"
                onClick={() => setField(field, Math.max(0, current[field] - 1))}
              >
                −
              </button>
              <input
                type="number"
                min={0}
                max={20}
                className="w-16 rounded border border-gray-300 px-2 py-1"
                value={current[field]}
                onChange={(e) => setField(field, Math.min(20, Math.max(0, Number(e.target.value) || 0)))}
              />
              <button
                type="button"
                className="rounded border border-gray-300 px-2 py-1 hover:bg-gray-50"
                onClick={() => setField(field, Math.min(20, current[field] + 1))}
              >
                +
              </button>
            </div>
          </label>
        ))}
      </div>

      <div className="mb-6 overflow-x-auto">
        <p className="mb-2 text-sm font-medium text-gray-700">Náhled mřížky A4</p>
        <LabelPreviewGrid
          templateKey={selectedKey}
          componentKey={selectedKey}
          pages={samplePages}
          gridOverrides={overrides}
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={save}
          disabled={busy}
          className="rounded-lg bg-red-600 px-4 py-2 text-sm text-white hover:bg-red-700 disabled:opacity-50"
        >
          {busy ? "Ukládám…" : "Uložit layout"}
        </button>
        <button
          type="button"
          onClick={resetKey}
          className="rounded-lg border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50"
        >
          Obnovit výchozí ({LAYOUT_OPTIONS.find((o) => o.key === selectedKey)?.label})
        </button>
      </div>
    </div>
  );
}
