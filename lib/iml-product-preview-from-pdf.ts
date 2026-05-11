/**
 * Převod první stránky PDF souboru na JPEG blob pro uložení jako `iml_products.image_data`
 * (náhled v katalogu přes stávající `/api/.../image`). Pouze z klientského kódu.
 */
const PDF_MAGIC = new Uint8Array([0x25, 0x50, 0x44, 0x46]); // %PDF

/** Maximální velikost vstupního PDF pro převod náhledu (ochrana prohlížeče). */
export const MAX_PREVIEW_PDF_BYTES = 15 * 1024 * 1024;

export async function pdfFileToJpegPreviewBlob(
  file: File,
  opts?: { maxSide?: number; jpegQuality?: number }
): Promise<Blob> {
  const maxSide = opts?.maxSide ?? 900;
  const jpegQuality = opts?.jpegQuality ?? 0.88;

  if (file.size > MAX_PREVIEW_PDF_BYTES) {
    throw new Error(
      `PDF pro náhled je příliš velký (max ${Math.round(MAX_PREVIEW_PDF_BYTES / (1024 * 1024))} MB). Zmenšete soubor nebo použijte obrázek.`
    );
  }

  const head = new Uint8Array(await file.slice(0, 4).arrayBuffer());
  if (head.length < 4 || head.some((b, i) => b !== PDF_MAGIC[i])) {
    throw new Error("Soubor není platné PDF.");
  }

  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

  const buf = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: new Uint8Array(buf), useSystemFonts: true }).promise;
  try {
    const page = await pdf.getPage(1);
    const base = page.getViewport({ scale: 1 });
    const scale = Math.min(maxSide / Math.max(base.width, base.height), 2);
    const viewport = page.getViewport({ scale });

    if (typeof document === "undefined") {
      throw new Error("Převod PDF na náhled je dostupný jen v prohlížeči.");
    }

    const canvas = document.createElement("canvas");
    const dpr = Math.min(typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1, 2);
    canvas.width = Math.floor(viewport.width * dpr);
    canvas.height = Math.floor(viewport.height * dpr);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Nelze vytvořit canvas.");

    ctx.scale(dpr, dpr);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, viewport.width, viewport.height);

    await page
      .render({
        canvasContext: ctx as unknown as CanvasRenderingContext2D,
        viewport,
      })
      .promise;

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((b) => resolve(b), "image/jpeg", jpegQuality)
    );
    if (!blob) throw new Error("Nepodařilo se vytvořit JPEG z PDF.");

    const maxOut = 5 * 1024 * 1024 - 64 * 1024; // pod limitem POST /image (5 MB)
    if (blob.size > maxOut) {
      const blob2 = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob((b) => resolve(b), "image/jpeg", 0.72)
      );
      if (!blob2 || blob2.size > maxOut) {
        throw new Error(
          "Náhled z PDF po převodu stále přesahuje limit 5 MB. Zkuste menší PDF nebo stránku s menší grafikou."
        );
      }
      return blob2;
    }
    return blob;
  } finally {
    await pdf.destroy?.().catch(() => {});
  }
}
