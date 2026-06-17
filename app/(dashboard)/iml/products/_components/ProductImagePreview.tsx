"use client";

import { useCallback, useEffect, useState } from "react";
import { ExternalLink, ImageOff, Minus, Plus, RotateCcw, X } from "lucide-react";
import { ProductPdfThumbnail } from "./ProductPdfThumbnail";

const LIGHTBOX_PDF_MAX_HEIGHT = 1200;

/**
 * Klikatelný náhled produktu s lightboxem.
 * - miniatura z uloženého JPEG nebo vykreslení z PDF
 * - lightbox preferuje vysoké rozlišení z PDF (pokud existuje)
 * - zoom kolečkem myši a tlačítky +/−
 */
export default function ProductImagePreview({
  productId,
  hasImage,
  hasPdf = false,
  className = "",
  imgClassName = "h-full w-full object-contain",
}: {
  productId: number;
  hasImage: boolean;
  hasPdf?: boolean;
  className?: string;
  imgClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [lightboxPdfHeight, setLightboxPdfHeight] = useState(LIGHTBOX_PDF_MAX_HEIGHT);

  useEffect(() => {
    if (!open) {
      setZoom(1);
      return;
    }
    setLightboxPdfHeight(Math.min(LIGHTBOX_PDF_MAX_HEIGHT, Math.floor(window.innerHeight * 0.85)));
  }, [open]);

  const zoomIn = useCallback(() => setZoom((z) => Math.min(4, Math.round((z + 0.25) * 100) / 100)), []);
  const zoomOut = useCallback(() => setZoom((z) => Math.max(0.5, Math.round((z - 0.25) * 100) / 100)), []);
  const resetZoom = useCallback(() => setZoom(1), []);

  const onWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const delta = e.deltaY < 0 ? 0.1 : -0.1;
    setZoom((z) => Math.min(4, Math.max(0.5, Math.round((z + delta) * 100) / 100)));
  }, []);

  const canPreview = hasImage || hasPdf;

  if (!canPreview) {
    return (
      <div
        className={
          "flex items-center justify-center rounded-lg border border-dashed border-gray-200 bg-gray-50 text-gray-300 " +
          className
        }
        title="Bez náhledu"
      >
        <ImageOff className="h-8 w-8" />
      </div>
    );
  }

  const thumbnail = hasImage ? (
    /* eslint-disable-next-line @next/next/no-img-element */
    <img
      src={`/api/iml/products/${productId}/image`}
      alt="Náhled produktu"
      className={imgClassName}
    />
  ) : (
    <ProductPdfThumbnail productId={productId} maxHeight={240} className="mx-auto" />
  );

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={
          "group relative overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm transition hover:border-red-400 " +
          className
        }
        title="Kliknutím zvětšit"
      >
        {thumbnail}
        <span className="pointer-events-none absolute inset-0 bg-black/0 transition group-hover:bg-black/5" />
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-50 flex flex-col bg-black/75"
        >
          <div
            className="flex shrink-0 items-center justify-between gap-2 border-b border-white/10 px-4 py-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={zoomOut}
                className="rounded-lg bg-white/10 p-2 text-white hover:bg-white/20"
                title="Zmenšit"
              >
                <Minus className="h-4 w-4" />
              </button>
              <span className="min-w-[3rem] text-center text-sm text-white">{Math.round(zoom * 100)}%</span>
              <button
                type="button"
                onClick={zoomIn}
                className="rounded-lg bg-white/10 p-2 text-white hover:bg-white/20"
                title="Zvětšit"
              >
                <Plus className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={resetZoom}
                className="rounded-lg bg-white/10 p-2 text-white hover:bg-white/20"
                title="Reset zoomu"
              >
                <RotateCcw className="h-4 w-4" />
              </button>
            </div>
            <div className="flex items-center gap-2">
              {hasPdf && (
                <a
                  href={`/api/iml/products/${productId}/pdf`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-2 text-sm text-white hover:bg-white/20"
                  onClick={(e) => e.stopPropagation()}
                >
                  <ExternalLink className="h-4 w-4" />
                  Otevřít PDF
                </a>
              )}
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg bg-white/10 p-2 text-white hover:bg-white/20"
                title="Zavřít"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          <div
            className="flex flex-1 items-center justify-center overflow-auto p-4"
            onWheel={onWheel}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{ transform: `scale(${zoom})`, transformOrigin: "center center" }}
              className="transition-transform"
            >
              {hasPdf ? (
                <ProductPdfThumbnail
                  productId={productId}
                  maxHeight={lightboxPdfHeight}
                  className="shadow-2xl"
                />
              ) : (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={`/api/iml/products/${productId}/image`}
                  alt="Náhled produktu"
                  className="max-h-[85vh] max-w-[95vw] rounded-lg bg-white object-contain shadow-2xl"
                />
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
