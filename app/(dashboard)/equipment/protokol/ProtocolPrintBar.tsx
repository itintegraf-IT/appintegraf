"use client";

import Link from "next/link";

type Props = {
  backHref: string;
};

/** Tlačítko jako v PHP (červená #C41E3A), bez auto-tisku znovu */
export function ProtocolPrintBar({ backHref }: Props) {
  return (
    <div className="no-print mb-2">
      <button
        type="button"
        onClick={() => window.print()}
        className="mb-2 cursor-pointer rounded border-0 px-4 py-2 text-xs text-white"
        style={{ background: "#C41E3A" }}
      >
        Tisknout
      </button>
      <div>
        <Link href={backHref} className="text-sm text-gray-600 underline">
          Zpět
        </Link>
      </div>
    </div>
  );
}
