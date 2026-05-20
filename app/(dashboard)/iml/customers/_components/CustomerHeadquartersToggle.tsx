"use client";

import { Building2 } from "lucide-react";

type Props = {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
};

export default function CustomerHeadquartersToggle({ checked, onChange, disabled }: Props) {
  return (
    <label
      className={`flex cursor-pointer items-start gap-4 rounded-xl border-2 p-5 transition-colors ${
        checked
          ? "border-red-400 bg-red-50/60"
          : "border-gray-200 bg-white hover:border-gray-300"
      } ${disabled ? "cursor-not-allowed opacity-60" : ""}`}
    >
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-1 h-5 w-5 flex-shrink-0 rounded border-gray-300 text-red-600 focus:ring-red-500"
      />
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <Building2 className={`h-5 w-5 ${checked ? "text-red-600" : "text-gray-500"}`} />
          <span className="text-base font-semibold text-gray-900">Centrála</span>
        </div>
        <p className="mt-1 text-sm text-gray-600">
          Tento zákazník je centrála skupiny – může mít pobočky se vlastními kontakty a
          doručovacími adresami. Katalog produktů je sdílený pro celou skupinu.
        </p>
      </div>
    </label>
  );
}
