"use client";

import { Image, FileText } from "lucide-react";

export function ProductFilesUploadPlaceholder() {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      <h3 className="mb-4 text-sm font-semibold text-gray-700">Obrázek a PDF</h3>
      <p className="mb-4 text-sm text-gray-500">
        Obrázek a tisková data (PDF) lze nahrát po uložení produktu.
      </p>
      <div className="grid gap-6 sm:grid-cols-2">
        <div>
          <p className="mb-2 text-sm text-gray-600">Náhled (JPG, PNG, WebP, GIF, max 5 MB)</p>
          <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 p-6 opacity-60">
            <Image className="mb-2 h-10 w-10 text-gray-400" />
            <span className="text-center text-sm text-gray-500">
              Klikněte pro nahrání obrázku
            </span>
            <span className="mt-1 text-xs text-gray-400">(dostupné po uložení)</span>
          </div>
        </div>
        <div>
          <p className="mb-2 text-sm text-gray-600">Tisková data (PDF, max 50 MB)</p>
          <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 p-6 opacity-60">
            <FileText className="mb-2 h-10 w-10 text-gray-400" />
            <span className="text-center text-sm text-gray-500">
              Klikněte pro nahrání PDF
            </span>
            <span className="mt-1 text-xs text-gray-400">(dostupné po uložení)</span>
          </div>
        </div>
      </div>
    </div>
  );
}
