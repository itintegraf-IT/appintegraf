"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";

type EquipmentCodeBadgeProps = {
  primaryLabel: string;
  primaryCode: string;
  secondaryLabel?: string;
  secondaryCode?: string | null;
  qrSrc?: string | null;
  hint?: string;
};

export function EquipmentCodeBadge({
  primaryLabel,
  primaryCode,
  secondaryLabel = "QR kód",
  secondaryCode,
  qrSrc,
  hint = "Tento kód zadejte ručně, pokud nelze skenovat.",
}: EquipmentCodeBadgeProps) {
  const [copied, setCopied] = useState<"primary" | "secondary" | null>(null);

  const copy = async (value: string, which: "primary" | "secondary") => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(which);
      window.setTimeout(() => setCopied(null), 1500);
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="rounded-xl border bg-white p-4 text-center shadow-sm">
      {qrSrc ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={qrSrc} alt="QR kód" className="mx-auto h-40 w-40" />
      ) : null}

      <p className="mt-3 text-xs font-medium uppercase tracking-wide text-gray-500">
        {primaryLabel}
      </p>
      <div className="mt-1 flex items-center justify-center gap-2">
        <p className="font-mono text-xl font-semibold tracking-wide text-gray-900">
          {primaryCode}
        </p>
        <button
          type="button"
          title="Kopírovat"
          onClick={() => void copy(primaryCode, "primary")}
          className="rounded border border-gray-200 p-1.5 text-gray-600 hover:bg-gray-50"
        >
          {copied === "primary" ? (
            <Check className="h-4 w-4 text-green-600" />
          ) : (
            <Copy className="h-4 w-4" />
          )}
        </button>
      </div>

      {secondaryCode ? (
        <div className="mt-3 border-t border-gray-100 pt-3">
          <p className="text-xs text-gray-500">{secondaryLabel}</p>
          <div className="mt-0.5 flex items-center justify-center gap-2">
            <p className="font-mono text-sm text-gray-700">{secondaryCode}</p>
            <button
              type="button"
              title="Kopírovat"
              onClick={() => void copy(secondaryCode, "secondary")}
              className="rounded border border-gray-200 p-1 text-gray-500 hover:bg-gray-50"
            >
              {copied === "secondary" ? (
                <Check className="h-3.5 w-3.5 text-green-600" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
            </button>
          </div>
        </div>
      ) : null}

      {hint ? <p className="mt-3 text-xs text-gray-500">{hint}</p> : null}
    </div>
  );
}

/** Jednotný placeholder pro ruční zadání kódu napříč modulem. */
export const EQUIPMENT_MANUAL_CODE_PLACEHOLDER =
  "Nebo zadejte inventární č. / kód místnosti";

export const EQUIPMENT_MANUAL_CODE_HINT =
  "Bez skeneru zadejte inventární číslo (EQ-…) nebo kód místnosti.";
