/**
 * Převod první stránky PDF na JPEG na serveru (import produktů).
 * Vyžaduje volitelný balíček `canvas`; bez něj vrátí null.
 */
export async function pdfBufferToJpeg(
  pdfBuffer: Buffer,
  opts?: { maxSide?: number; jpegQuality?: number }
): Promise<Buffer | null> {
  const maxSide = opts?.maxSide ?? 900;
  const jpegQuality = opts?.jpegQuality ?? 0.88;

  if (
    pdfBuffer.length < 5 ||
    pdfBuffer[0] !== 0x25 ||
    pdfBuffer[1] !== 0x50 ||
    pdfBuffer[2] !== 0x44 ||
    pdfBuffer[3] !== 0x46
  ) {
    return null;
  }

  try {
    const canvasMod = await importOptionalCanvas();
    if (!canvasMod) return null;

    const { createCanvas } = canvasMod;
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");

    const loadingTask = pdfjs.getDocument({
      data: new Uint8Array(pdfBuffer),
      useSystemFonts: true,
    });
    const pdf = await loadingTask.promise;

    try {
      const page = await pdf.getPage(1);
      const baseViewport = page.getViewport({ scale: 1 });
      const scale = Math.min(maxSide / Math.max(baseViewport.width, baseViewport.height), 2);
      const viewport = page.getViewport({ scale });

      const canvas = createCanvas(
        Math.floor(viewport.width),
        Math.floor(viewport.height)
      );
      const ctx = canvas.getContext("2d");
      if (!ctx) return null;

      await page
        .render({
          canvas,
          canvasContext: ctx,
          viewport,
        } as Parameters<typeof page.render>[0])
        .promise;

      return canvas.toBuffer("image/jpeg", { quality: jpegQuality });
    } finally {
      await pdf.destroy();
    }
  } catch {
    return null;
  }
}

export async function isPdfThumbnailGenerationAvailable(): Promise<boolean> {
  return (await importOptionalCanvas()) !== null;
}

async function importOptionalCanvas(): Promise<{
  createCanvas: (w: number, h: number) => {
    getContext: (type: "2d") => CanvasRenderingContext2D | null;
    toBuffer: (mime: string, opts?: { quality?: number }) => Buffer;
  };
} | null> {
  try {
    const mod = await import(
      /* webpackIgnore: true */ "canvas"
    );
    return mod as {
      createCanvas: (w: number, h: number) => {
        getContext: (type: "2d") => CanvasRenderingContext2D | null;
        toBuffer: (mime: string, opts?: { quality?: number }) => Buffer;
      };
    };
  } catch {
    return null;
  }
}
