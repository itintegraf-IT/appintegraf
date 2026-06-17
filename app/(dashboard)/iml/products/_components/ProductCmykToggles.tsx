"use client";

import type { ProductCmykFlags } from "@/lib/iml-print-colors-summary";
import { CMYK_ALL_OFF } from "@/lib/iml-print-colors-summary";

type Props = {
  flags: ProductCmykFlags;
  onChange: (flags: ProductCmykFlags) => void;
  hasPantone: boolean;
};

const CHANNELS: Array<{ key: keyof ProductCmykFlags; label: string; title: string }> = [
  { key: "c", label: "C", title: "Cyan" },
  { key: "m", label: "M", title: "Magenta" },
  { key: "y", label: "Y", title: "Yellow" },
  { key: "k", label: "K", title: "Black (Key)" },
];

export default function ProductCmykToggles({ flags, onChange, hasPantone }: Props) {
  const allOff = !flags.c && !flags.m && !flags.y && !flags.k;
  const disabled = hasPantone;

  return (
    <div
      className={`mb-6 rounded-xl border p-4 ${
        disabled ? "border-gray-200 bg-gray-100 opacity-80" : "border-gray-200 bg-gray-50"
      }`}
    >
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h4 className="text-sm font-semibold text-gray-800">Procesní barvy (CMYK)</h4>
          <p className="mt-1 text-xs text-gray-500">
            {disabled
              ? "Etiketa používá Pantone – procesní CMYK se neeviduje."
              : "Výchozí předpoklad: tisk v CMYK. Vypněte kanály, které se u etikety nepoužívají."}
          </p>
        </div>
        {!disabled && (
          <button
            type="button"
            onClick={() => onChange(CMYK_ALL_OFF)}
            className="shrink-0 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
          >
            Vypnout CMYK
          </button>
        )}
      </div>
      <div className="flex flex-wrap gap-3">
        {CHANNELS.map(({ key, label, title }) => (
          <label
            key={key}
            title={title}
            className={`inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition ${
              disabled
                ? "cursor-not-allowed border-gray-200 bg-gray-50 text-gray-400"
                : flags[key]
                  ? "cursor-pointer border-cyan-600 bg-white text-cyan-900 shadow-sm"
                  : "cursor-pointer border-gray-300 bg-gray-100 text-gray-500"
            }`}
          >
            <input
              type="checkbox"
              checked={flags[key]}
              disabled={disabled}
              onChange={(e) => onChange({ ...flags, [key]: e.target.checked })}
              className="rounded border-gray-300 disabled:opacity-50"
            />
            {label}
          </label>
        ))}
      </div>
      {allOff && !hasPantone && (
        <p className="mt-3 text-sm text-amber-800">
          Nemáte zapnutý žádný CMYK kanál ani Pantone barvu – doplňte alespoň jednu barvu tisku.
        </p>
      )}
    </div>
  );
}
