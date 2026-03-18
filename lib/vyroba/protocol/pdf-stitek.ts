/**
 * Štítek PDF – podle Protokoly.py (ST), více štítků na A4
 */
import { PDFPage, PDFFont, rgb } from "pdf-lib";
import { StitekInput } from "./types";
import { JOB_LABELS } from "../config/fix-settings";

const mm = (x: number) => x * 2.83465;

function getJobInfo(job: string): { nazev: string; typ: string } {
  if (job.includes("NEXGO"))
    return {
      nazev: "Jízdní doklad POP NEXGO",
      typ: "Hm 0 735 2 4125    KSM  2252384",
    };
  if (job.includes("CD_POP") && !job.includes("NEXGO"))
    return {
      nazev: "Jízdní doklad POP",
      typ: "Hm 0 735 2 4116    KSM  2103671",
    };
  if (job.includes("CD_Vnitro"))
    return {
      nazev: "Jízdní doklad vnitrostátní",
      typ: "Hm 0 735 2 4123    KSM 2187909",
    };
  if (job.includes("CD_Validator"))
    return {
      nazev: "Jízdenka do validátoru",
      typ: "Hm 0 735 2 4124    KSM 2252349 ",
    };
  if (job.includes("DPB_AVJ"))
    return {
      nazev: "Kotuče na tlač cestovných lístkov",
      typ: "Sml. č.:     ",
    };
  return {
    nazev: JOB_LABELS[job] ?? job,
    typ: "",
  };
}

const POZICE: [number, number][] = [
  [10, 10],
  [115, 10],
  [10, 80],
  [115, 80],
  [10, 150],
  [115, 150],
  [10, 220],
  [115, 220],
  [10, 290],
  [115, 290],
];

export async function createStitekPdf(
  input: StitekInput,
  page: PDFPage,
  font: PDFFont,
  fontBold: PDFFont,
  poziceIndex: number
): Promise<void> {
  const { job, cisloKrabice, cKrabNaPalete, balil, serie, rows } = input;
  const mnozstvi = String(rows.length);
  const [dx, dy] = POZICE[poziceIndex % POZICE.length];
  const { nazev, typ } = getJobInfo(job);
  const isDPB = job.includes("DPB_AVJ");
  const showVypisS =
    isDPB || job.includes("CD_Vnitro") || job.includes("CD_Validator");

  const baseX = mm(dx);
  const baseY = page.getHeight() - mm(dy);

  let y = 0;

  page.drawText(nazev, {
    x: baseX,
    y: baseY - y,
    size: 11,
    font: fontBold,
  });
  y += mm(4);

  page.drawText(typ, {
    x: baseX,
    y: baseY - y,
    size: 9,
    font: fontBold,
  });
  y += mm(4);

  if (showVypisS && rows.length > 0) {
    const vypisS = rows
      .map((r) => `${r.ks}/${r.serie}/${r.cisloOd}`)
      .join("   ");
    page.drawRectangle({
      x: baseX,
      y: baseY - y - mm(12),
      width: mm(86),
      height: mm(12),
      borderColor: rgb(0, 0, 0),
      borderWidth: 0.5,
      color: rgb(0.86, 0.86, 0.86),
    });
    page.drawText(vypisS, {
      x: baseX + 2,
      y: baseY - y - mm(10),
      size: 8,
      font,
    });
    y += mm(14);
  }

  y += mm(1.4);
  const krabCislo = `Serie: ${serie}   Krabice č.: ${cKrabNaPalete}.       Počet ks v bal: ${mnozstvi}`;
  page.drawText(krabCislo, {
    x: baseX,
    y: baseY - y,
    size: 9,
    font: fontBold,
  });
  y += mm(4);

  const skladovani =
    "Skladujte v rozmezí teplot max: +20 +/-5°C \na v max relat. vlhkosti vzduchu: 60% +/-10%";
  page.drawText(skladovani, {
    x: baseX,
    y: baseY - y,
    size: 6,
    font,
  });
  y += mm(8);

  page.drawText(cisloKrabice, {
    x: baseX,
    y: baseY - y,
    size: 7,
    font,
  });
}
