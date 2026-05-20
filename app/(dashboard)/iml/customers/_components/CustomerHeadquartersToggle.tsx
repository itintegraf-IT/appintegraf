"use client";

import { Building2 } from "lucide-react";

type Props = {
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** Blokuje pouze odškrtnutí (centrála s pobočkami) */
  uncheckLocked?: boolean;
  variant?: "card" | "inline";
  /** Nápověda po zaškrtnutí u nového/samostatného zákazníka */
  showConvertHint?: boolean;
};

export default function CustomerHeadquartersToggle({
  checked,
  onChange,
  uncheckLocked = false,
  variant = "card",
  showConvertHint = false,
}: Props) {
  const handleChange = (next: boolean) => {
    if (uncheckLocked && checked && !next) return;
    onChange(next);
  };

  const isInline = variant === "inline";

  return (
    <label
      className={`flex cursor-pointer items-start gap-3 transition-colors ${
        isInline
          ? `rounded-lg border p-3 ${
              checked
                ? "border-red-300 bg-red-50/50"
                : "border-gray-200 bg-gray-50/80 hover:border-gray-300"
            }`
          : `rounded-xl border-2 p-5 ${
              checked
                ? "border-red-400 bg-red-50/60"
                : "border-gray-200 bg-white hover:border-gray-300"
            }`
      } ${uncheckLocked && checked ? "cursor-default" : ""}`}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => handleChange(e.target.checked)}
        className="mt-0.5 h-5 w-5 flex-shrink-0 rounded border-gray-300 text-red-600 focus:ring-red-500"
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <Building2 className={`h-5 w-5 flex-shrink-0 ${checked ? "text-red-600" : "text-gray-500"}`} />
          <span className={`font-semibold text-gray-900 ${isInline ? "text-sm" : "text-base"}`}>
            Centrála
          </span>
        </div>
        <p className={`mt-1 text-gray-600 ${isInline ? "text-xs" : "text-sm"}`}>
          Tento zákazník je centrála skupiny – může mít pobočky se vlastními kontakty a doručovacími
          adresami. Katalog produktů je sdílený pro celou skupinu.
        </p>
        {uncheckLocked && checked && (
          <p className="mt-1 text-xs text-amber-700">
            Centrálu nelze zrušit, dokud máte pobočky.
          </p>
        )}
        {showConvertHint && checked && !uncheckLocked && (
          <p className="mt-1 text-xs text-gray-500">
            Po uložení bude zákazník centrálou skupiny – pobočky přidáte níže ve formuláři.
          </p>
        )}
      </div>
    </label>
  );
}
