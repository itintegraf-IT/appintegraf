"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  productId: number;
  hasPrintSample: boolean;
  hasPrintProof: boolean;
};

/**
 * Omezená editace „Máme vzor min. tisku“ / „Máme nátisk“ pro roli Správa vzorků.
 */
export function ProductSampleFlagsEditor({
  productId,
  hasPrintSample,
  hasPrintProof,
}: Props) {
  const router = useRouter();
  const [sample, setSample] = useState(hasPrintSample);
  const [proof, setProof] = useState(hasPrintProof);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  const dirty = sample !== hasPrintSample || proof !== hasPrintProof;

  const handleSave = async () => {
    setError("");
    setSaved(false);
    setLoading(true);
    try {
      const res = await fetch(`/api/iml/products/${productId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          has_print_sample: sample,
          has_print_proof: proof,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Chyba při ukládání");
        setLoading(false);
        return;
      }
      setSaved(true);
      setLoading(false);
      router.refresh();
    } catch {
      setError("Chyba při ukládání");
      setLoading(false);
    }
  };

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50/60 p-4">
      <p className="mb-3 text-sm text-amber-900">
        Jako <strong>Správa vzorků</strong> můžete u produktu upravit pouze tato dvě pole.
      </p>
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id={`sample-flags-sample-${productId}`}
            checked={sample}
            onChange={(e) => {
              setSample(e.target.checked);
              setSaved(false);
            }}
            className="rounded border-gray-300"
          />
          <label
            htmlFor={`sample-flags-sample-${productId}`}
            className="text-sm font-medium text-gray-800"
          >
            Máme vzor min. tisku
          </label>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id={`sample-flags-proof-${productId}`}
            checked={proof}
            onChange={(e) => {
              setProof(e.target.checked);
              setSaved(false);
            }}
            className="rounded border-gray-300"
          />
          <label
            htmlFor={`sample-flags-proof-${productId}`}
            className="text-sm font-medium text-gray-800"
          >
            Máme nátisk
          </label>
        </div>
      </div>
      {error && <p className="mt-3 text-sm text-red-700">{error}</p>}
      {saved && !dirty && (
        <p className="mt-3 text-sm text-green-700">Uloženo.</p>
      )}
      <div className="mt-4">
        <button
          type="button"
          onClick={handleSave}
          disabled={loading || !dirty}
          className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
        >
          {loading ? "Ukládám…" : "Uložit vzorky"}
        </button>
      </div>
    </div>
  );
}
