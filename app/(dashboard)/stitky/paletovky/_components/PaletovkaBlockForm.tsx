"use client";

import type { PaletovkaBlockData } from "@/lib/stitky/paletovky/types";

type Props = {
  block: PaletovkaBlockData;
  index: number;
  onUpdate: (b: PaletovkaBlockData) => void;
  readOnly?: boolean;
};

export function PaletovkaBlockForm({ block, index, onUpdate, readOnly }: Props) {
  const set = (patch: Partial<PaletovkaBlockData>) => onUpdate({ ...block, ...patch });

  return (
    <fieldset className="rounded-lg border border-gray-200 p-4">
      <legend className="px-2 text-sm font-semibold text-gray-700">Blok {index + 1}</legend>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm">
          Zadavatel
          <input
            className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5"
            value={block.zadavatel}
            onChange={(e) => set({ zadavatel: e.target.value })}
            disabled={readOnly}
          />
        </label>
        <label className="block text-sm">
          Zakázka
          <input
            className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5"
            value={block.zakazka}
            onChange={(e) => set({ zakazka: e.target.value })}
            disabled={readOnly}
          />
        </label>
        <label className="block text-sm">
          Číslo zakázky
          <input
            className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5"
            value={block.cisloZakazky}
            onChange={(e) => set({ cisloZakazky: e.target.value })}
            disabled={readOnly}
          />
        </label>
        <label className="block text-sm">
          Balení
          <input
            className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5"
            value={block.baleniPopis}
            onChange={(e) => set({ baleniPopis: e.target.value })}
            disabled={readOnly}
          />
        </label>
        <label className="block text-sm">
          Jednotka
          <select
            className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5"
            value={block.jednotkaLabel}
            onChange={(e) =>
              set({ jednotkaLabel: e.target.value as "Paleta" | "Krabice" })
            }
            disabled={readOnly}
          >
            <option value="Paleta">Paleta</option>
            <option value="Krabice">Krabice</option>
          </select>
        </label>
      </div>
      <div className="mt-4 space-y-2">
        <p className="text-sm font-medium text-gray-700">Řádky nákladu</p>
        {block.radky.map((row, ri) => (
          <div key={ri} className="grid gap-2 sm:grid-cols-3">
            <input
              placeholder="Množství"
              className="rounded border border-gray-300 px-2 py-1.5 text-sm"
              value={row.mnozstvi}
              onChange={(e) => {
                const radky = [...block.radky];
                radky[ri] = { ...row, mnozstvi: e.target.value };
                set({ radky });
              }}
              disabled={readOnly}
            />
            <input
              placeholder="Popis"
              className="rounded border border-gray-300 px-2 py-1.5 text-sm"
              value={row.popis}
              onChange={(e) => {
                const radky = [...block.radky];
                radky[ri] = { ...row, popis: e.target.value };
                set({ radky });
              }}
              disabled={readOnly}
            />
            <input
              placeholder="Č."
              className="rounded border border-gray-300 px-2 py-1.5 text-sm"
              value={row.cislo}
              onChange={(e) => {
                const radky = [...block.radky];
                radky[ri] = { ...row, cislo: e.target.value };
                set({ radky });
              }}
              disabled={readOnly}
            />
          </div>
        ))}
        {!readOnly && (
          <button
            type="button"
            className="text-sm text-red-700 hover:underline"
            onClick={() => set({ radky: [...block.radky, { mnozstvi: "", popis: "", cislo: "" }] })}
          >
            + řádek
          </button>
        )}
      </div>
    </fieldset>
  );
}
