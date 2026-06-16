/**
 * Převod první stránky PDF na JPEG na serveru (import / miniatury produktů).
 * Používá @napi-rs/canvas (prebuilt binárky, bez libcairo na serveru).
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

      const quality = Math.min(100, Math.max(1, Math.round(jpegQuality * 100)));
      const encoded = await canvas.encode("jpeg", quality);
      return Buffer.from(encoded);
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

type NapiCanvas = {
  getContext: (type: "2d") => CanvasRenderingContext2D | null;
  encode: (mime: "jpeg" | "png", quality?: number) => Promise<Uint8Array>;
};

async function importOptionalCanvas(): Promise<{
  createCanvas: (w: number, h: number) => NapiCanvas;
} | null> {
  try {
    // createRequire obchází statickou analýzu bundleru (nativní .node binding).
    const { createRequire } = await import("node:module");
    const require = createRequire(import.meta.url);
    return require("@napi-rs/canvas") as {
      createCanvas: (w: number, h: number) => NapiCanvas;
    };
  } catch {
    return null;
  }
}
