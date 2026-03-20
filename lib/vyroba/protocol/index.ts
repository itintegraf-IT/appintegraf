/**
 * Protokoly a sestavy – hlavní export
 */
import { PDFDocument } from "pdf-lib";
import { setupPdfWithFonts } from "./fonts";
import { createBalnyListPdf } from "./pdf-baleni-list";
import { createStitekPdf } from "./pdf-stitek";
import { createIgtPaletaPdf } from "./igt-paleta";
import { createIgtInkjetyTxt } from "./igt-inkjety";
import type {
  BalnyListInput,
  StitekInput,
  IgtPaletaInput,
  IgtInkjetyInput,
} from "./types";

const CD_JOBS = [
  "CD_POP",
  "CD_POP_NEXGO",
  "CD_Vnitro",
  "CD_Validator",
  "DPB_AVJ",
];

export function isCdJob(job: string): boolean {
  return CD_JOBS.some((j: string) => job.includes(j));
}

export function isIgtJob(job: string): boolean {
  return job === "IGT_Sazka";
}

/**
 * Generuje PDF: Balný list + Štítek (pro CD/DPB joby)
 */
export async function generateProtocolPdf(
  balnyListInput: BalnyListInput,
  stitekInput: StitekInput
): Promise<Uint8Array> {
  const { doc, font, fontBold } = await setupPdfWithFonts();
  const page = doc.addPage([595, 842]);

  let y = mm(20);
  y = await createBalnyListPdf(balnyListInput, page, font, fontBold, y);

  const stitekPage = doc.addPage([595, 842]);
  await createStitekPdf(stitekInput, stitekPage, font, fontBold, 0);

  const pdfBytes = await doc.save();
  return pdfBytes;
}

/**
 * Generuje pouze Balný list PDF (1 stránka)
 */
export async function generateBalnyListOnly(
  input: BalnyListInput
): Promise<Uint8Array> {
  const { doc, font, fontBold } = await setupPdfWithFonts();
  const page = doc.addPage([595, 842]);
  await createBalnyListPdf(input, page, font, fontBold, mm(20));
  return doc.save();
}

/**
 * Generuje pouze Štítek PDF
 */
export async function generateStitekOnly(
  input: StitekInput
): Promise<Uint8Array> {
  const { doc, font, fontBold } = await setupPdfWithFonts();
  const page = doc.addPage([595, 842]);
  await createStitekPdf(input, page, font, fontBold, 0);
  return doc.save();
}

/**
 * Generuje paletový list IGT
 */
export async function generateIgtPaletaPdf(
  input: IgtPaletaInput
): Promise<Uint8Array> {
  const { doc, font, fontBold } = await setupPdfWithFonts();
  await createIgtPaletaPdf(input, doc, font, fontBold);
  return doc.save();
}

/**
 * Generuje TXT pro jehličkovou tiskárnu (IGT)
 */
export function generateIgtInkjetyTxt(input: IgtInkjetyInput): string {
  return createIgtInkjetyTxt(input);
}

export type {
  BalnyListInput,
  StitekInput,
  IgtPaletaInput,
  IgtInkjetyInput,
  ProtocolRow,
} from "./types";

const mm = (x: number) => x * 2.83465;
