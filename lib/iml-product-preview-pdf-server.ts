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
        } as unknown as Parameters<typeof page.render>[0])
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

export type CanvasLoadDiagnostics = {
  available: boolean;
  error: string | null;
};

let lastCanvasLoadError: string | null = null;

export function getCanvasLoadDiagnostics(): CanvasLoadDiagnostics {
  return {
    available: lastCanvasLoadError === null,
    error: lastCanvasLoadError,
  };
}

export async function isPdfThumbnailGenerationAvailable(): Promise<boolean> {
  const mod = await importOptionalCanvas();
  return mod !== null;
}

export async function probeCanvasAvailability(): Promise<CanvasLoadDiagnostics> {
  const mod = await importOptionalCanvas();
  if (mod) {
    try {
      const canvas = mod.createCanvas(1, 1);
      if (typeof canvas.encode !== "function") {
        lastCanvasLoadError = "createCanvas nevrátil očekávané API (encode)";
        return { available: false, error: lastCanvasLoadError };
      }
      lastCanvasLoadError = null;
      return { available: true, error: null };
    } catch (e) {
      lastCanvasLoadError = e instanceof Error ? e.message : String(e);
      return { available: false, error: lastCanvasLoadError };
    }
  }
  return {
    available: false,
    error: lastCanvasLoadError ?? "Modul @napi-rs/canvas se nepodařilo načíst",
  };
}

type NapiCanvas = {
  getContext: (type: "2d") => unknown;
  encode: (mime: "jpeg" | "png", quality?: number) => Promise<Uint8Array>;
};

type NapiCanvasModule = {
  createCanvas: (w: number, h: number) => NapiCanvas;
};

function formatLoadError(e: unknown): string {
  if (e instanceof Error) return e.message;
  return String(e);
}

async function importOptionalCanvas(): Promise<NapiCanvasModule | null> {
  try {
    const mod = await import("@napi-rs/canvas");
    lastCanvasLoadError = null;
    return mod as unknown as NapiCanvasModule;
  } catch (e) {
    lastCanvasLoadError = formatLoadError(e);
    console.error("[iml] @napi-rs/canvas unavailable:", lastCanvasLoadError);
    return null;
  }
}
