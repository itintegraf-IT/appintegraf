"use client";

import { useEffect, useRef, useState } from "react";
import { FileText } from "lucide-react";

export type ProductPdfThumbnailProps = {
  productId: number;
  /** Maximální výška náhledu v CSS px (šířka se dopočítá z poměru stránky). */
  maxHeight?: number;
  className?: string;
  /** Volitelně pro invalidaci cache po nahrání nového PDF (např. Date.now()). */
  cacheBust?: string | number;
};

/**
 * Náhled první stránky PDF (klient pdf.js). Neukládá se do DB – po změně PDF stačí obnovit stránku
 * nebo změnit cacheBust; GET /pdf vždy vrací aktuální primární verzi.
 */
export function ProductPdfThumbnail({
  productId,
  maxHeight = 96,
  className = "",
  cacheBust,
}: ProductPdfThumbnailProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !productId) return;

    let cancelled = false;
    let renderTask: { cancel: () => void } | null = null;

    const run = async () => {
      setFailed(false);
      setLoading(true);
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        setFailed(true);
        setLoading(false);
        return;
      }
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      try {
        const pdfjs = await import("pdfjs-dist");
        if (cancelled) return;

        pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

        const q = cacheBust != null ? `?t=${encodeURIComponent(String(cacheBust))}` : "";
        const res = await fetch(`/api/iml/products/${productId}/pdf${q}`, {
          credentials: "same-origin",
        });
        if (!res.ok) throw new Error("pdf_fetch");
        const buf = await res.arrayBuffer();
        if (cancelled) return;

        const loadingTask = pdfjs.getDocument({
          data: new Uint8Array(buf),
          useSystemFonts: true,
        });

        const pdf = await loadingTask.promise;
        if (cancelled) {
          await pdf.destroy?.().catch(() => {});
          return;
        }

        const page = await pdf.getPage(1);
        const base = page.getViewport({ scale: 1 });
        const scale = Math.min(maxHeight / base.height, 2);
        const viewport = page.getViewport({ scale });

        const dpr = typeof window !== "undefined" ? Math.min(window.devicePixelRatio || 1, 2) : 1;
        canvas.width = Math.max(1, Math.floor(viewport.width * dpr));
        canvas.height = Math.max(1, Math.floor(viewport.height * dpr));
        canvas.style.width = `${Math.floor(viewport.width)}px`;
        canvas.style.height = `${Math.floor(viewport.height)}px`;

        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.scale(dpr, dpr);
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, viewport.width, viewport.height);

        const task = page.render({
          canvasContext: ctx as unknown as CanvasRenderingContext2D,
          viewport,
        });
        renderTask = task;
        await task.promise;
        await pdf.destroy?.().catch(() => {});

        if (cancelled) return;
        setLoading(false);
      } catch {
        if (!cancelled) {
          setFailed(true);
          setLoading(false);
        }
      }
    };

    void run();

    return () => {
      cancelled = true;
      renderTask?.cancel();
    };
  }, [productId, maxHeight, cacheBust]);

  if (failed) {
    return (
      <div
        className={`flex items-center justify-center rounded-lg border border-dashed border-gray-300 bg-gray-50 text-gray-400 ${className}`}
        style={{ width: maxHeight, height: maxHeight }}
        title="Náhled z PDF nelze vykreslit"
      >
        <FileText className="h-8 w-8" />
      </div>
    );
  }

  return (
    <div className={`relative inline-flex ${className}`}>
      {loading && maxHeight >= 48 && (
        <div
          className="absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-white/70 text-xs text-gray-500"
          style={{ minWidth: maxHeight * 0.6, minHeight: maxHeight * 0.6 }}
        >
          …
        </div>
      )}
      <canvas ref={canvasRef} className="rounded-lg border border-gray-200 bg-white" aria-label="Náhled první stránky PDF" />
    </div>
  );
}
