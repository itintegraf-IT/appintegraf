/**
 * Načtení fontů pro PDF (DejaVu – diakritika)
 */
import path from "path";
import fs from "fs";
import { PDFDocument } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";

let fontCache: { regular: Uint8Array; bold: Uint8Array } | null = null;

function getFontPaths(): { regular: string; bold: string } {
  const base = path.join(process.cwd(), "node_modules", "dejavu-fonts-ttf", "ttf");
  return {
    regular: path.join(base, "DejaVuSansCondensed.ttf"),
    bold: path.join(base, "DejaVuSansCondensed-Bold.ttf"),
  };
}

export function loadFonts(): { regular: Uint8Array; bold: Uint8Array } {
  if (fontCache) return fontCache;
  const { regular: regPath, bold: boldPath } = getFontPaths();
  fontCache = {
    regular: new Uint8Array(fs.readFileSync(regPath)),
    bold: new Uint8Array(fs.readFileSync(boldPath)),
  };
  return fontCache;
}

export async function setupPdfWithFonts(): Promise<{
  doc: PDFDocument;
  font: Awaited<ReturnType<PDFDocument["embedFont"]>>;
  fontBold: Awaited<ReturnType<PDFDocument["embedFont"]>>;
}> {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const { regular, bold } = loadFonts();
  const font = await doc.embedFont(regular);
  const fontBold = await doc.embedFont(bold);
  return { doc, font, fontBold };
}
