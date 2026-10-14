"use client";

import { useState } from "react";

type Props = {
  productId: number;
  isLocked?: boolean;
  version?: number | null;
  className?: string;
  children: React.ReactNode;
  /** download vs inline open */
  download?: boolean;
};

type Step = 0 | 1 | 2;

/**
 * Stažení / otevření výrobního PDF.
 * U zamčeného produktu vyžaduje dvě po sobě jdoucí potvrzení.
 */
export function LockedPdfDownload({
  productId,
  isLocked = false,
  version = null,
  className,
  children,
  download = false,
}: Props) {
  const [step, setStep] = useState<Step>(0);
  const [busy, setBusy] = useState(false);

  const buildUrl = (confirm: boolean) => {
    const params = new URLSearchParams();
    if (version != null) params.set("version", String(version));
    if (confirm) params.set("confirm_locked", "1");
    const q = params.toString();
    return `/api/iml/products/${productId}/pdf${q ? `?${q}` : ""}`;
  };

  const close = () => setStep(0);

  const openBlob = async (confirm: boolean) => {
    setBusy(true);
    try {
      const res = await fetch(buildUrl(confirm));
      if (res.status === 409) {
        setStep(1);
        return;
      }
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        alert(text || `Stažení PDF selhalo (${res.status})`);
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      if (download) {
        const a = document.createElement("a");
        a.href = url;
        a.download = `produkt-${productId}.pdf`;
        a.click();
      } else {
        window.open(url, "_blank", "noopener,noreferrer");
      }
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
      close();
    } finally {
      setBusy(false);
    }
  };

  const onClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (isLocked) {
      setStep(1);
      return;
    }
    void openBlob(false);
  };

  return (
    <>
      <button type="button" className={className} onClick={onClick} disabled={busy}>
        {children}
      </button>
      {step === 1 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-w-md rounded-xl bg-white p-5 shadow-xl">
            <h3 className="text-lg font-semibold text-amber-900">Data jsou v úpravě!</h3>
            <p className="mt-2 text-sm text-gray-700">
              Tato položka je aktuálně v úpravě grafikem. Stávající tisková data nemusí
              odpovídat finální verzi.
            </p>
            <div className="mt-4 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
                onClick={close}
                disabled={busy}
              >
                Zrušit
              </button>
              <button
                type="button"
                className="rounded-lg bg-amber-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50"
                onClick={() => setStep(2)}
                disabled={busy}
              >
                Rozumím, pokračovat
              </button>
            </div>
          </div>
        </div>
      )}
      {step === 2 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-w-md rounded-xl bg-white p-5 shadow-xl">
            <h3 className="text-lg font-semibold text-amber-900">
              Opravdu stáhnout? Data se upravují!
            </h3>
            <p className="mt-2 text-sm text-gray-700">
              Potvrďte, že chcete stáhnout a použít stávající data pro výrobu i přes
              probíhající úpravu grafikem.
            </p>
            <div className="mt-4 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
                onClick={close}
                disabled={busy}
              >
                Zrušit
              </button>
              <button
                type="button"
                className="rounded-lg bg-amber-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50"
                onClick={() => void openBlob(true)}
                disabled={busy}
              >
                {busy ? "Stahuji…" : "Ano, stáhnout"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
