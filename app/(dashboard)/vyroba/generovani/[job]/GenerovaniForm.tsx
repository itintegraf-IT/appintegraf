"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, FileOutput, Loader2 } from "lucide-react";
import { JOB_LABELS } from "@/lib/vyroba/config/fix-settings";

type Props = {
  job: string;
  canWrite: boolean;
};

export default function GenerovaniForm({ job, canWrite }: Props) {
  const [pocetKS, setPocetKS] = useState("");
  const [cislovaniVypnuto, setCislovaniVypnuto] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    txtPath?: string;
    csvPath?: string;
    pocetVyhozu?: number;
    error?: string;
  } | null>(null);

  const isIGT = job === "IGT_Sazka";
  const label = JOB_LABELS[job] ?? job;
  const inputLabel = isIGT ? "Počet předčíslí" : "Počet kusů";
  const inputHint = isIGT
    ? "1 série = 960 předčíslí. Minimum je 6×10 = 60 předčíslí"
    : "";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canWrite) return;

    const val = parseInt(pocetKS, 10);
    if (isNaN(val) || val < 1) {
      setResult({ success: false, error: "Zadejte platný počet" });
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      const res = await fetch(`/api/vyroba/generate/${job}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pocetKS: isIGT ? undefined : val,
          pocetPredcisli: isIGT ? val : undefined,
          cislovaniVypnuto: job === "CD_Vnitro" || job === "CD_Validator" ? cislovaniVypnuto : undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setResult({ success: false, error: data.error ?? "Chyba při generování" });
        return;
      }

      setResult({
        success: true,
        txtPath: data.txtPath,
        csvPath: data.csvPath,
        pocetVyhozu: data.pocetVyhozu,
      });
    } catch (err) {
      setResult({
        success: false,
        error: err instanceof Error ? err.message : "Chyba při generování",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="mb-6 flex items-center gap-4">
        <Link
          href="/vyroba"
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Zpět
        </Link>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h1 className="flex items-center gap-2 text-xl font-bold text-gray-900">
          <FileOutput className="h-6 w-6 text-amber-600" />
          Generování – {label}
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Vytvoření datových souborů (CSV/TXT) pro tiskárny
        </p>

        {canWrite ? (
          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div>
              <label htmlFor="pocet" className="block text-sm font-medium text-gray-700">
                {inputLabel}
              </label>
              <input
                id="pocet"
                type="number"
                min="1"
                value={pocetKS}
                onChange={(e) => setPocetKS(e.target.value)}
                placeholder={isIGT ? "60" : "100"}
                className="mt-1 block w-full max-w-xs rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
              />
              {inputHint && (
                <p className="mt-1 text-xs text-gray-500">{inputHint}</p>
              )}
            </div>

            {(job === "CD_Vnitro" || job === "CD_Validator") && (
              <div className="flex items-center gap-2">
                <input
                  id="cislovani"
                  type="checkbox"
                  checked={cislovaniVypnuto}
                  onChange={(e) => setCislovaniVypnuto(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-amber-600 focus:ring-amber-500"
                />
                <label htmlFor="cislovani" className="text-sm text-gray-700">
                  Vypnout číslování (výroba vzorků)
                </label>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-lg bg-amber-600 px-4 py-2 font-medium text-white hover:bg-amber-700 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Generuji…
                </>
              ) : (
                "Generovat"
              )}
            </button>
          </form>
        ) : (
          <p className="mt-4 text-sm text-gray-500">
            Nemáte oprávnění pro generování. Pro provedení akce potřebujete přístup k zápisu.
          </p>
        )}

        {result && (
          <div
            className={`mt-6 rounded-lg p-4 ${
              result.success ? "bg-green-50 text-green-800" : "bg-red-50 text-red-800"
            }`}
          >
            {result.success ? (
              <>
                <p className="font-medium">Generování dokončeno</p>
                {result.pocetVyhozu != null && (
                  <p className="mt-1 text-sm">Počet výhozů: {result.pocetVyhozu}</p>
                )}
                {result.txtPath && (
                  <p className="mt-1 text-sm font-mono break-all">{result.txtPath}</p>
                )}
              </>
            ) : (
              <>
                <p className="font-medium">Chyba</p>
                <p className="mt-1 text-sm">{result.error}</p>
              </>
            )}
          </div>
        )}
      </div>
    </>
  );
}
