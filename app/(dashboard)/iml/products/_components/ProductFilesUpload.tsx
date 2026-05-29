"use client";

import { useState, useRef } from "react";
import { Image, FileText, Trash2, Upload } from "lucide-react";
import { ProductPdfThumbnail } from "./ProductPdfThumbnail";
import { pdfFileToJpegPreviewBlob } from "@/lib/iml-product-preview-from-pdf";

const PREVIEW_FILE_ACCEPT =
  "image/jpeg,image/png,image/webp,image/gif,application/pdf,.pdf";

type Props = {
  productId: number;
  hasImage: boolean;
  hasPdf: boolean;
  onImageChange?: () => void;
  onPdfChange?: () => void;
};

export function ProductFilesUpload({ productId, hasImage, hasPdf, onImageChange, onPdfChange }: Props) {
  const imageInputRef = useRef<HTMLInputElement>(null);
  const pdfInputRef = useRef<HTMLInputElement>(null);
  const [imageLoading, setImageLoading] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [imageError, setImageError] = useState("");
  const [pdfError, setPdfError] = useState("");

  const pickImage = () => imageInputRef.current?.click();
  const pickPdf = () => pdfInputRef.current?.click();
  const fileInputClass = "sr-only";

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageError("");
    setImageLoading(true);
    try {
      const isPdf =
        file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
      let fileToUpload: File = file;
      if (isPdf) {
        try {
          const blob = await pdfFileToJpegPreviewBlob(file);
          fileToUpload = new File([blob], "nahled-z-pdf.jpg", { type: "image/jpeg" });
        } catch (convErr) {
          setImageError(convErr instanceof Error ? convErr.message : "PDF nelze převést na náhled.");
          return;
        }
      }

      const formData = new FormData();
      formData.append("file", fileToUpload);
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
    if (!confirm("Opravdu smazat náhled (obrázek)?")) return;
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
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        if (res.status === 413) {
          setPdfError(
            "Požadavek byl odmítnut (413) – typicky malý `client_max_body_size` u nginx. Nastavte alespoň 60M u location pro aplikaci a znovu načtěte konfiguraci."
          );
          return;
        }
        setPdfError(
          typeof data.error === "string" && data.error.length > 0
            ? data.error
            : "Chyba při nahrávání"
        );
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
          <p className="mb-2 text-sm text-gray-600">
            Náhled – obrázek (JPG, PNG, WebP, GIF) nebo PDF (1. stránka → uloží se jako JPEG, max. 5 MB)
            {!hasImage && hasPdf && (
              <span className="mt-0.5 block text-xs font-normal text-gray-500">
                Dokud nenahrajete vlastní náhled výše, zobrazí se první stránka tiskových dat (PDF vpravo).
              </span>
            )}
          </p>
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
                <button
                  type="button"
                  onClick={pickImage}
                  disabled={imageLoading}
                  aria-label="Nahrát jiný náhled (obrázek nebo PDF)"
                  className="inline-flex cursor-pointer items-center gap-1 rounded border border-gray-300 px-2 py-1 text-sm text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Upload className="h-4 w-4" />
                  Nahradit
                </button>
                <input
                  ref={imageInputRef}
                  type="file"
                  accept={PREVIEW_FILE_ACCEPT}
                  onChange={handleImageUpload}
                  disabled={imageLoading}
                  className={fileInputClass}
                  tabIndex={-1}
                />
              </div>
            </div>
          ) : hasPdf ? (
            <div className="flex items-center gap-2">
              <ProductPdfThumbnail productId={productId} maxHeight={96} className="shrink-0" />
              <div className="flex flex-col gap-1">
                <button
                  type="button"
                  onClick={pickImage}
                  disabled={imageLoading}
                  aria-label="Nahrát náhled z obrázku nebo PDF (1. stránka)"
                  className="inline-flex cursor-pointer items-center gap-1 rounded border border-gray-300 px-2 py-1 text-sm text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Upload className="h-4 w-4" />
                  Nahrát náhled
                </button>
                <input
                  ref={imageInputRef}
                  type="file"
                  accept={PREVIEW_FILE_ACCEPT}
                  onChange={handleImageUpload}
                  disabled={imageLoading}
                  className={fileInputClass}
                  tabIndex={-1}
                />
              </div>
            </div>
          ) : (
            <>
              <button
                type="button"
                onClick={pickImage}
                disabled={imageLoading}
                aria-label="Vybrat náhled – obrázek nebo PDF"
                className="flex w-full cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 p-6 text-left transition-colors hover:border-gray-400 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Image className="mb-2 h-10 w-10 text-gray-400" />
                <span className="text-sm text-gray-600">Klikněte pro nahrání náhledu (obrázek nebo PDF)</span>
              </button>
              <input
                ref={imageInputRef}
                type="file"
                accept={PREVIEW_FILE_ACCEPT}
                onChange={handleImageUpload}
                disabled={imageLoading}
                className={fileInputClass}
                tabIndex={-1}
              />
            </>
          )}
          {imageError && <p className="mt-1 text-sm text-red-600">{imageError}</p>}
        </div>

        <div>
          <p className="mb-2 text-sm text-gray-600">Tisková data (PDF, max 50 MB)</p>
          {hasPdf ? (
            <div className="flex items-center gap-2">
              <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-gray-100">
                {hasImage ? (
                  <ProductPdfThumbnail productId={productId} maxHeight={96} className="max-h-24 max-w-24" />
                ) : (
                  <FileText className="h-10 w-10 text-gray-500" />
                )}
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
                <button
                  type="button"
                  onClick={pickPdf}
                  disabled={pdfLoading}
                  aria-label="Nahrát jiné PDF"
                  className="inline-flex cursor-pointer items-center gap-1 rounded border border-gray-300 px-2 py-1 text-sm text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Upload className="h-4 w-4" />
                  Nahradit
                </button>
                <input
                  ref={pdfInputRef}
                  type="file"
                  accept="application/pdf"
                  onChange={handlePdfUpload}
                  disabled={pdfLoading}
                  className={fileInputClass}
                  tabIndex={-1}
                />
              </div>
            </div>
          ) : (
            <>
              <button
                type="button"
                onClick={pickPdf}
                disabled={pdfLoading}
                aria-label="Vybrat PDF k nahrání"
                className="flex w-full cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 p-6 text-left transition-colors hover:border-gray-400 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <FileText className="mb-2 h-10 w-10 text-gray-400" />
                <span className="text-sm text-gray-600">Klikněte pro nahrání PDF</span>
              </button>
              <input
                ref={pdfInputRef}
                type="file"
                accept="application/pdf"
                onChange={handlePdfUpload}
                disabled={pdfLoading}
                className={fileInputClass}
                tabIndex={-1}
              />
            </>
          )}
          {pdfError && <p className="mt-1 text-sm text-red-600">{pdfError}</p>}
        </div>
      </div>
    </div>
  );
}
