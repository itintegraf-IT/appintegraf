"use client";

import { useState } from "react";
import { Image, FileText, Trash2, Upload } from "lucide-react";

type Props = {
  productId: number;
  hasImage: boolean;
  hasPdf: boolean;
  onImageChange?: () => void;
  onPdfChange?: () => void;
};

export function ProductFilesUpload({ productId, hasImage, hasPdf, onImageChange, onPdfChange }: Props) {
  const [imageLoading, setImageLoading] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [imageError, setImageError] = useState("");
  const [pdfError, setPdfError] = useState("");

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageError("");
    setImageLoading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`/api/iml/products/${productId}/image`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setImageError(data.error ?? "Chyba při nahrávání");
        return;
      }
      onImageChange?.();
      window.location.reload();
    } catch {
      setImageError("Chyba při nahrávání");
    } finally {
      setImageLoading(false);
      e.target.value = "";
    }
  };

  const handleImageDelete = async () => {
    if (!confirm("Opravdu smazat obrázek?")) return;
    setImageError("");
    setImageLoading(true);
    try {
      const res = await fetch(`/api/iml/products/${productId}/image`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setImageError(data.error ?? "Chyba při mazání");
        return;
      }
      onImageChange?.();
      window.location.reload();
    } catch {
      setImageError("Chyba při mazání");
    } finally {
      setImageLoading(false);
    }
  };

  const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPdfError("");
    setPdfLoading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`/api/iml/products/${productId}/pdf`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setPdfError(data.error ?? "Chyba při nahrávání");
        return;
      }
      onPdfChange?.();
      window.location.reload();
    } catch {
      setPdfError("Chyba při nahrávání");
    } finally {
      setPdfLoading(false);
      e.target.value = "";
    }
  };

  const handlePdfDelete = async () => {
    if (!confirm("Opravdu smazat PDF?")) return;
    setPdfError("");
    setPdfLoading(true);
    try {
      const res = await fetch(`/api/iml/products/${productId}/pdf`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setPdfError(data.error ?? "Chyba při mazání");
        return;
      }
      onPdfChange?.();
      window.location.reload();
    } catch {
      setPdfError("Chyba při mazání");
    } finally {
      setPdfLoading(false);
    }
  };

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      <h3 className="mb-4 text-sm font-semibold text-gray-700">Obrázek a PDF</h3>
      <div className="grid gap-6 sm:grid-cols-2">
        <div>
          <p className="mb-2 text-sm text-gray-600">Náhled (JPG, PNG, WebP, GIF, max 5 MB)</p>
          {hasImage ? (
            <div className="flex items-center gap-2">
              <img
                src={`/api/iml/products/${productId}/image?t=${Date.now()}`}
                alt="Náhled"
                className="h-24 w-24 rounded-lg border object-cover"
              />
              <div className="flex flex-col gap-1">
                <button
                  type="button"
                  onClick={handleImageDelete}
                  disabled={imageLoading}
                  className="inline-flex items-center gap-1 rounded border border-red-200 px-2 py-1 text-sm text-red-600 hover:bg-red-50 disabled:opacity-50"
                >
                  <Trash2 className="h-4 w-4" />
                  Smazat
                </button>
                <label className="inline-flex cursor-pointer items-center gap-1 rounded border border-gray-300 px-2 py-1 text-sm text-gray-700 hover:bg-gray-50">
                  <Upload className="h-4 w-4" />
                  Nahradit
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    onChange={handleImageUpload}
                    disabled={imageLoading}
                    className="hidden"
                  />
                </label>
              </div>
            </div>
          ) : (
            <label className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 p-6 transition-colors hover:border-gray-400 hover:bg-gray-100">
              <Image className="mb-2 h-10 w-10 text-gray-400" />
              <span className="text-sm text-gray-600">Klikněte pro nahrání obrázku</span>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                onChange={handleImageUpload}
                disabled={imageLoading}
                className="hidden"
              />
            </label>
          )}
          {imageError && <p className="mt-1 text-sm text-red-600">{imageError}</p>}
        </div>

        <div>
          <p className="mb-2 text-sm text-gray-600">Tisková data (PDF, max 20 MB)</p>
          {hasPdf ? (
            <div className="flex items-center gap-2">
              <div className="flex h-24 w-24 items-center justify-center rounded-lg border bg-gray-100">
                <FileText className="h-10 w-10 text-gray-500" />
              </div>
              <div className="flex flex-col gap-1">
                <a
                  href={`/api/iml/products/${productId}/pdf`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 rounded border border-gray-300 px-2 py-1 text-sm text-gray-700 hover:bg-gray-50"
                >
                  Zobrazit PDF
                </a>
                <button
                  type="button"
                  onClick={handlePdfDelete}
                  disabled={pdfLoading}
                  className="inline-flex items-center gap-1 rounded border border-red-200 px-2 py-1 text-sm text-red-600 hover:bg-red-50 disabled:opacity-50"
                >
                  <Trash2 className="h-4 w-4" />
                  Smazat
                </button>
                <label className="inline-flex cursor-pointer items-center gap-1 rounded border border-gray-300 px-2 py-1 text-sm text-gray-700 hover:bg-gray-50">
                  <Upload className="h-4 w-4" />
                  Nahradit
                  <input
                    type="file"
                    accept="application/pdf"
                    onChange={handlePdfUpload}
                    disabled={pdfLoading}
                    className="hidden"
                  />
                </label>
              </div>
            </div>
          ) : (
            <label className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 p-6 transition-colors hover:border-gray-400 hover:bg-gray-100">
              <FileText className="mb-2 h-10 w-10 text-gray-400" />
              <span className="text-sm text-gray-600">Klikněte pro nahrání PDF</span>
              <input
                type="file"
                accept="application/pdf"
                onChange={handlePdfUpload}
                disabled={pdfLoading}
                className="hidden"
              />
            </label>
          )}
          {pdfError && <p className="mt-1 text-sm text-red-600">{pdfError}</p>}
        </div>
      </div>
    </div>
  );
}
