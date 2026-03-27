import { PDFParse } from "pdf-parse";

/** Extrakce textu z textového PDF (naskenované stránky bez OCR vrací málo textu). */
export async function extractTextFromPdfBuffer(buffer: Buffer): Promise<{
  text: string;
  pageCount: number;
}> {
  const parser = new PDFParse({ data: buffer });
  const result = await parser.getText();
  const text = (result.text ?? "").trim();
  const pageCount = result.pages?.length ?? result.total ?? 0;
  return { text, pageCount };
}
