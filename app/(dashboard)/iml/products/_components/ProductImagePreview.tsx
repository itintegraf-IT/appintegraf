"use client";

import { useState } from "react";
import { ImageOff, X } from "lucide-react";

/**
 * Klikatelný náhled obrázku produktu s lightboxem.
 * - thumbnail zobrazuje obrázek z /api/iml/products/{id}/image
 * - klik otevře fullscreen overlay, zavírá se klikem mimo nebo křížkem
 * - když obrázek chybí, zobrazí se placeholder (ikona)
 *
 * `size` řídí velikost miniatury (CSS třídy – defaultně large „w-full h-60").
 */
export default function ProductImagePreview({
  productId,
  hasImage,
  className = "",
  imgClassName = "h-full w-full object-contain",
}: {
  productId: number;
  hasImage: boolean;
  className?: string;
  imgClassName?: string;
}) {
  const [open, setOpen] = useState(false);

  if (!hasImage) {
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
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`/api/iml/products/${productId}/image`}
          alt="Náhled produktu"
          className={imgClassName}
        />
        <span className="pointer-events-none absolute inset-0 bg-black/0 transition group-hover:bg-black/5" />
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
        >
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setOpen(false);
            }}
            className="absolute right-4 top-4 rounded-full bg-white/90 p-2 text-gray-700 shadow hover:bg-white"
            title="Zavřít"
          >
            <X className="h-5 w-5" />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`/api/iml/products/${productId}/image`}
            alt="Náhled produktu"
            onClick={(e) => e.stopPropagation()}
            className="max-h-[90vh] max-w-[95vw] rounded-lg bg-white object-contain shadow-2xl"
          />
        </div>
      )}
    </>
  );
}
