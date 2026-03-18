/**
 * Balný list PDF – podle Protokoly.py Ulozeni_PDF (BL)
 */
import { PDFPage, PDFFont, rgb } from "pdf-lib";
import { BalnyListInput } from "./types";
import { JOB_LABELS } from "../config/fix-settings";

const mm = (x: number) => x * 2.83465;

function getJobInfo(job: string): { nazev: string; typ: string } {
  if (job.includes("NEXGO"))
    return {
      nazev: "Jízdní doklad POP NEXGO",
      typ: "Hm 0 735 2 4125    KSM  2252384",
    };
  if (job.includes("CD_POP"))
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
      typ: "Hm 0 735 2 4124    KSM 2252349",
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

export async function createBalnyListPdf(
  input: BalnyListInput,
  page: PDFPage,
  font: PDFFont,
  fontBold: PDFFont,
  startY: number
): Promise<number> {
  const { job, cisloKrabice, cKrabNaPalete, balil, rows } = input;
  const mnozstvi = String(rows.length);
  const { nazev, typ } = getJobInfo(job);
  const isDPB = job.includes("DPB_AVJ");

  const th = 7;
  let y = startY;

  page.drawText(cisloKrabice, {
    x: mm(20),
    y: page.getHeight() - y,
    size: 6,
    font,
  });
  y += mm(10);

  page.drawText("BALNÝ LIST", {
    x: mm(55),
    y: page.getHeight() - y,
    size: 16,
    font: fontBold,
  });
  y += mm(40);

  page.drawText(nazev, {
    x: mm(20),
    y: page.getHeight() - y,
    size: 12,
    font: fontBold,
  });
  y += mm(10);

  page.drawText(typ, {
    x: mm(20),
    y: page.getHeight() - y,
    size: 12,
    font: fontBold,
  });
  y += mm(25);

  const reversed = [...rows].reverse();
  const withPoradi = reversed.map((r, i) => ({
    ...r,
    poradi: String(i + 1).padStart(2, "0"),
  }));
  const polovina = Math.ceil(withPoradi.length / 2);
  const firstHalf = withPoradi.slice(0, polovina);
  const secondHalf = withPoradi.slice(polovina);

  const cellW = [10, 10, 16, 16] as const;
  const headerX1 = mm(55);
  const headerX2 = mm(110);

  const drawTableHeader = (x: number) => {
    const headers = ["Poř. č.:", "Serie.:", "Od č.:", "Do č.:"];
    let cx = x;
    for (let i = 0; i < 4; i++) {
      page.drawRectangle({
        x: cx,
        y: page.getHeight() - y - mm(4),
        width: mm(cellW[i]),
        height: mm(4.5),
        borderColor: rgb(0, 0, 0),
        borderWidth: 0.5,
      });
      page.drawText(headers[i], {
        x: cx + 2,
        y: page.getHeight() - y - mm(3.5),
        size: 7,
        font: fontBold,
      });
      cx += mm(cellW[i]);
    }
    y += mm(5);
  };

  drawTableHeader(headerX1);
  for (const r of firstHalf) {
    const cisloDo = isDPB ? "-" : r.cisloDo;
    const cells = [r.poradi, r.serie, r.cisloOd, cisloDo];
    let cx = headerX1;
    for (let i = 0; i < 4; i++) {
      page.drawRectangle({
        x: cx,
        y: page.getHeight() - y - mm(3.5),
        width: mm(cellW[i]),
        height: mm(3.5),
        borderColor: rgb(0, 0, 0),
        borderWidth: 0.5,
      });
      page.drawText(cells[i], {
        x: cx + 2,
        y: page.getHeight() - y - mm(2.8),
        size: 9,
        font,
      });
      cx += mm(cellW[i]);
    }
    y += mm(4);
  }

  y += mm(5);
  drawTableHeader(headerX2);
  for (const r of secondHalf) {
    const cisloDo = isDPB ? "-" : r.cisloDo;
    const cells = [r.poradi, r.serie, r.cisloOd, cisloDo];
    let cx = headerX2;
    for (let i = 0; i < 4; i++) {
      page.drawRectangle({
        x: cx,
        y: page.getHeight() - y - mm(3.5),
        width: mm(cellW[i]),
        height: mm(3.5),
        borderColor: rgb(0, 0, 0),
        borderWidth: 0.5,
      });
      page.drawText(cells[i], {
        x: cx + 2,
        y: page.getHeight() - y - mm(2.8),
        size: 9,
        font,
      });
      cx += mm(cellW[i]);
    }
    y += mm(4);
  }

  y += mm(15);
  const krabCislo = `Krabice č: ${cKrabNaPalete}   `;
  const mnozstviStr = `Počet ks: ${mnozstvi}`;
  page.drawText(krabCislo, {
    x: mm(20),
    y: page.getHeight() - y,
    size: 8,
    font: fontBold,
  });
  page.drawText(mnozstviStr, {
    x: mm(80),
    y: page.getHeight() - y,
    size: 8,
    font: fontBold,
  });
  y += mm(15);

  const kontrola = `Kontroloval a balil: ${balil}`;
  page.drawText(kontrola, {
    x: mm(20),
    y: page.getHeight() - y,
    size: 8,
    font,
  });
  y += mm(10);

  const skladovani =
    "Skladujte v rozmezí teplot max: +20 +/-5°C a v max relat. vlhkosti vzduchu: 60% +/-10%";
  page.drawText(skladovani, {
    x: mm(20),
    y: page.getHeight() - y,
    size: 8,
    font,
  });

  return y + mm(20);
}
