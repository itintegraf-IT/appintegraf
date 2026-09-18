"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Download, X } from "lucide-react";
import { getPreviewKind, type VykresyPreviewKind } from "@/lib/vykresy/constants";
import { VykresyPdfPreview } from "./VykresyPdfPreview";

export type VykresyPreviewFile = {
  id: number;
  original_filename: string;
  vykresId: number;
};

type Props = {
  file: VykresyPreviewFile | null;
  onClose: () => void;
};

export function VykresyFilePreviewModal({ file, onClose }: Props) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!file) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [file, onClose]);

  if (!mounted || !file) return null;

  const kind: VykresyPreviewKind = getPreviewKind(file.original_filename);
  const downloadUrl = `/api/vykresy/${file.vykresId}/files/${file.id}`;
  const inlineUrl = `${downloadUrl}?inline=1`;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="vykresy-file-preview-title"
      onClick={onClose}
    >
      <div
        className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-gray-200 px-4 py-3">
          <div className="min-w-0">
            <h2
              id="vykresy-file-preview-title"
              className="truncate text-sm font-semibold text-gray-900"
            >
              {file.original_filename}
            </h2>
            {kind === "pdf" ? (
              <p className="mt-0.5 text-xs text-gray-500">Náhled PDF</p>
            ) : (
              <p className="mt-0.5 text-xs text-gray-500">Náhled není k dispozici</p>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <a
              href={downloadUrl}
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-2.5 py-1.5 text-xs text-red-600 hover:bg-gray-50"
            >
              <Download className="h-3.5 w-3.5 shrink-0" aria-hidden />
              <span>Stáhnout</span>
            </a>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"
              title="Zavřít (Esc)"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-auto bg-gray-100 p-3 sm:p-4">
          {kind === "pdf" ? (
            <VykresyPdfPreview src={inlineUrl} title={file.original_filename} />
          ) : (
            <div className="flex h-[min(40vh,320px)] flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-gray-300 bg-white px-4 text-center text-sm text-gray-600">
              <p>
                Pro tento formát (3D/CAD) není prohlížečový náhled k dispozici.
                Soubor si stáhněte a otevřete v příslušné aplikaci.
              </p>
              <a
                href={downloadUrl}
                className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-2 text-xs font-medium text-white hover:bg-red-700"
              >
                <Download className="h-3.5 w-3.5" />
                Stáhnout soubor
              </a>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
