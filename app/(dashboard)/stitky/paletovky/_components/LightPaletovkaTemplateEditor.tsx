"use client";

import { useState } from "react";
import { PaletovkaBlockForm } from "./PaletovkaBlockForm";
import { PaletovkaPreview } from "./PaletovkaPreview";
import {
  parsePaletovkaLayoutJson,
  type PaletovkaDocumentData,
  type PaletovkaLayoutJson,
  type PaletovkaLayoutVariant,
} from "@/lib/stitky/paletovky/types";

type Props = {
  templateId: number;
  initialName: string;
  layoutVariant: PaletovkaLayoutVariant;
  blocksPerPage: number;
  initialDefaults: PaletovkaDocumentData;
  initialLayoutJson: PaletovkaLayoutJson;
  onSaved?: () => void;
  backHref?: string;
};

function MmInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  const step = (delta: number) => onChange(Math.round((value + delta) * 10) / 10);
  return (
    <label className="block text-xs text-gray-600">
      {label}
      <div className="mt-1 flex items-center gap-1">
        <button
          type="button"
          className="rounded border border-gray-300 px-2 py-1 text-sm hover:bg-gray-50"
          onClick={() => step(-1)}
        >
          −
        </button>
        <input
          type="number"
          step={0.5}
          className="w-16 rounded border border-gray-300 px-2 py-1 text-sm"
          value={value}
          onChange={(e) => onChange(Number(e.target.value) || 0)}
        />
        <button
          type="button"
          className="rounded border border-gray-300 px-2 py-1 text-sm hover:bg-gray-50"
          onClick={() => step(1)}
        >
          +
        </button>
        <span className="text-gray-400">mm</span>
      </div>
    </label>
  );
}

function ensureFrameRegions(layout: PaletovkaLayoutJson, blockCount: number): PaletovkaLayoutJson {
  const blocks = [...layout.blocks];
  while (blocks.length < blockCount) {
    blocks.push({
      originCol: 0,
      originRow: 0,
      regions: [{ key: "frame", xMm: 15, yMm: 15, wMm: 180, hMm: 75 }],
    });
  }
  return {
    ...layout,
    blocks: blocks.map((b, i) => {
      const frame = b.regions.find((r) => r.key === "frame");
      if (frame) return b;
      const fallback = layout.blocks[i]?.regions.find((r) => r.key === "frame");
      return {
        ...b,
        regions: [
          fallback ?? { key: "frame", xMm: 15, yMm: 15, wMm: 180, hMm: 75 },
          ...b.regions.filter((r) => r.key !== "frame"),
        ],
      };
    }),
  };
}

export function LightPaletovkaTemplateEditor({
  templateId,
  initialName,
  layoutVariant,
  blocksPerPage,
  initialDefaults,
  initialLayoutJson,
  onSaved,
}: Props) {
  const [name, setName] = useState(initialName);
  const [defaults, setDefaults] = useState<PaletovkaDocumentData>(initialDefaults);
  const [layoutJson, setLayoutJson] = useState<PaletovkaLayoutJson>(
    ensureFrameRegions(initialLayoutJson, blocksPerPage)
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const updateFrame = (blockIndex: number, patch: Partial<{ xMm: number; yMm: number; wMm: number; hMm: number }>) => {
    setLayoutJson((prev) => {
      const next = ensureFrameRegions(prev, blocksPerPage);
      const blocks = next.blocks.map((b, i) => {
        if (i !== blockIndex) return b;
        const regions = b.regions.map((r) =>
          r.key === "frame" ? { ...r, ...patch } : r
        );
        if (!regions.some((r) => r.key === "frame")) {
          regions.unshift({ key: "frame", xMm: 15, yMm: 15, wMm: 180, hMm: 75, ...patch });
        }
        return { ...b, regions };
      });
      return { ...next, blocks };
    });
  };

  const save = async () => {
    setBusy(true);
    setError(null);
    setMsg(null);
    try {
      const res = await fetch(`/api/stitky/paletovky/templates/${templateId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          defaultsJson: defaults,
          layoutJson,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? "Uložení selhalo");
      setMsg("Uloženo");
      onSaved?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Chyba");
    } finally {
      setBusy(false);
    }
  };

  const layout = ensureFrameRegions(layoutJson, blocksPerPage);

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-800">
          {error}
        </div>
      )}
      {msg && (
        <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-2 text-sm text-green-800">
          {msg}
        </div>
      )}

      <label className="block max-w-md text-sm">
        Název šablony
        <input
          className="mt-1 w-full rounded border border-gray-300 px-3 py-2"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </label>

      <p className="text-sm text-gray-600">
        Layout: <strong>{layoutVariant}</strong> ({blocksPerPage} bloků na stránku)
      </p>

      <div className="grid gap-8 xl:grid-cols-2">
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-gray-800">Výchozí data</h3>
          {defaults.blocks.map((block, i) => (
            <PaletovkaBlockForm
              key={i}
              block={block}
              index={i}
              onUpdate={(b) => {
                const blocks = [...defaults.blocks];
                blocks[i] = b;
                setDefaults({ blocks });
              }}
            />
          ))}

          <h3 className="pt-4 text-sm font-semibold text-gray-800">Pozice rámečku (PDF)</h3>
          {layout.blocks.slice(0, blocksPerPage).map((b, i) => {
            const frame = b.regions.find((r) => r.key === "frame") ?? {
              key: "frame",
              xMm: 15,
              yMm: 15,
              wMm: 180,
              hMm: 75,
            };
            return (
              <fieldset key={i} className="rounded-lg border border-gray-100 bg-gray-50 p-3">
                <legend className="px-2 text-xs font-medium text-gray-600">Blok {i + 1}</legend>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <MmInput label="X" value={frame.xMm} onChange={(v) => updateFrame(i, { xMm: v })} />
                  <MmInput label="Y" value={frame.yMm} onChange={(v) => updateFrame(i, { yMm: v })} />
                  <MmInput label="Šířka" value={frame.wMm} onChange={(v) => updateFrame(i, { wMm: v })} />
                  <MmInput label="Výška" value={frame.hMm} onChange={(v) => updateFrame(i, { hMm: v })} />
                </div>
              </fieldset>
            );
          })}
        </div>

        <div>
          <h3 className="mb-2 text-sm font-semibold text-gray-800">Náhled</h3>
          <PaletovkaPreview data={defaults} layoutVariant={layoutVariant} />
        </div>
      </div>

      <button
        type="button"
        onClick={save}
        disabled={busy}
        className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
      >
        {busy ? "Ukládám…" : "Uložit šablonu"}
      </button>
    </div>
  );
}

export function parseLayoutForEditor(raw: unknown): PaletovkaLayoutJson {
  return (
    parsePaletovkaLayoutJson(raw) ?? {
      variant: "single",
      blocks: [{ originCol: 0, originRow: 0, regions: [{ key: "frame", xMm: 15, yMm: 15, wMm: 180, hMm: 75 }] }],
      pageWidthMm: 210,
      pageHeightMm: 297,
    }
  );
}
