"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { FileDown, Printer } from "lucide-react";
import { PaletovkaForm } from "../_components/PaletovkaForm";
import type { PaletovkaDocumentData, PaletovkaLayoutVariant } from "@/lib/stitky/paletovky/types";

type Props = {
  paletovkaId: number;
  title: string;
  status: string;
  layoutVariant: PaletovkaLayoutVariant;
  blocksPerPage: number;
  initialData: PaletovkaDocumentData;
  canWrite: boolean;
};

export function PaletovkaDetailClient({
  paletovkaId,
  title: initialTitle,
  status,
  layoutVariant,
  blocksPerPage,
  initialData,
  canWrite,
}: Props) {
  const router = useRouter();
  const [title, setTitle] = useState(initialTitle);
  const [data, setData] = useState(initialData);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/stitky/paletovky/${paletovkaId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, data }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? "Uložení selhalo");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Chyba");
    } finally {
      setBusy(false);
    }
  };

  const downloadPdf = async () => {
    setBusy(true);
    try {
      const res = await fetch(`/api/stitky/paletovky/${paletovkaId}/pdf`);
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error ?? "PDF selhalo");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `paletovka_${paletovkaId}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Chyba PDF");
    } finally {
      setBusy(false);
    }
  };

  const printPage = () => window.print();

  const remove = async () => {
    if (!confirm("Opravdu smazat paletovku?")) return;
    const res = await fetch(`/api/stitky/paletovky/${paletovkaId}`, { method: "DELETE" });
    if (res.ok) {
      router.push("/stitky/paletovky");
      router.refresh();
    }
  };

  return (
    <div>
      <Link href="/stitky/paletovky" className="mb-4 inline-block text-sm text-red-700 hover:underline">
        ← Zpět na paletovky
      </Link>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <label className="flex-1 text-sm">
          Název
          <input
            className="mt-1 w-full max-w-md rounded border border-gray-300 px-3 py-2"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            disabled={!canWrite}
          />
        </label>
        <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium">{status}</span>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-800">
          {error}
        </div>
      )}

      <div className="mb-4 flex flex-wrap gap-2 print:hidden">
        {canWrite && (
          <button
            type="button"
            onClick={save}
            disabled={busy}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
          >
            Uložit
          </button>
        )}
        <button
          type="button"
          onClick={downloadPdf}
          disabled={busy}
          className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50"
        >
          <FileDown className="h-4 w-4" />
          PDF
        </button>
        <button
          type="button"
          onClick={printPage}
          className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50"
        >
          <Printer className="h-4 w-4" />
          Tisk
        </button>
        {canWrite && status === "DRAFT" && (
          <button
            type="button"
            onClick={remove}
            className="rounded-lg border border-red-300 px-4 py-2 text-sm text-red-700 hover:bg-red-50"
          >
            Smazat
          </button>
        )}
      </div>

      <div className="print:paletovka-print-area">
        <PaletovkaForm
          layoutVariant={layoutVariant}
          blocksPerPage={blocksPerPage}
          initial={initialData}
          onChange={setData}
          readOnly={!canWrite}
        />
      </div>
    </div>
  );
}
