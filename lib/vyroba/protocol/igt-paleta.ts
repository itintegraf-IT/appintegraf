/**
 * Paletový list IGT – podle Protokoly_IGT_Sazka.py Stitek_Paleta
 */
import { PDFDocument, PDFPage, PDFFont, rgb } from "pdf-lib";
import { IgtPaletaInput } from "./types";

const mm = (x: number) => x * 2.83465;

export async function createIgtPaletaPdf(
  input: IgtPaletaInput,
  doc: PDFDocument,
  font: PDFFont,
  fontBold: PDFFont
): Promise<PDFDocument> {
  const { cisloZakazky, cisloPalety, boxes } = input;
  const cisloPaletyF = String(cisloPalety).padStart(2, "0");

  const page = doc.addPage([595, 842]);
  let y = mm(25);

  page.drawText("Paletový lístek", {
    x: mm(80),
    y: page.getHeight() - y,
    size: 12,
    font: fontBold,
  });
  y += mm(6);

  page.drawText(
    `Číslo zakázky: ${cisloZakazky},  Paleta č: ${cisloPaletyF}`,
    {
      x: mm(40),
      y: page.getHeight() - y,
      size: 9,
      font: fontBold,
    }
  );
  y += mm(8);

  const th = mm(4);
  const x1 = mm(18);
  const x2 = mm(110);
  const headers = ["Č. pal.", "Č. krabice", "Od čísla", "Do čísla", "Série"];
  const colW = [10, 15, 22, 22, 15] as const;

  const drawHeader = (x: number) => {
    let cx = x;
    for (let i = 0; i < 5; i++) {
      page.drawRectangle({
        x: cx,
        y: page.getHeight() - y - th,
        width: mm(colW[i]),
        height: th,
        borderColor: rgb(0, 0, 0),
        borderWidth: 0.5,
      });
      page.drawText(headers[i], {
        x: cx + 2,
        y: page.getHeight() - y - th + 1,
        size: 7,
        font: fontBold,
      });
      cx += mm(colW[i]);
    }
    y += th + mm(1);
  };

  drawHeader(x1);
  drawHeader(x2);

  const leftRows: string[][] = [];
  const rightRows: string[][] = [];
  let boxIdx = 1;
  for (const box of boxes) {
    const cisloKrabiceF = String(box.cisloKrabice).padStart(6, "0");
    const cp = String(box.cisloPalety).padStart(2, "0");
    for (const r of box.rows) {
      const row = [cp, cisloKrabiceF, r.cisloOd, r.cisloDo, r.serie];
      if (boxIdx % 2 !== 0) {
        leftRows.push(row);
      } else {
        rightRows.push(row);
      }
    }
    boxIdx++;
  }

  const maxRows = Math.max(leftRows.length, rightRows.length);
  for (let i = 0; i < maxRows; i += 4) {
    const leftBatch = leftRows.slice(i, i + 4);
    const rightBatch = rightRows.slice(i, i + 4);
    while (leftBatch.length < 4) leftBatch.push(["", "", "", "", ""]);
    while (rightBatch.length < 4) rightBatch.push(["", "", "", "", ""]);

    for (let k = 0; k < 4; k++) {
      const A = leftBatch[k];
      const B = rightBatch[k];
      let cx = x1;
      for (let j = 0; j < 5; j++) {
        page.drawRectangle({
          x: cx,
          y: page.getHeight() - y - th,
          width: mm(colW[j]),
          height: th,
          borderColor: rgb(0, 0, 0),
          borderWidth: 0.5,
        });
        page.drawText(A[j] ?? "", {
          x: cx + 2,
          y: page.getHeight() - y - th + 1,
          size: 7,
          font,
        });
        cx += mm(colW[j]);
      }
      cx += mm(8);
      for (let j = 0; j < 5; j++) {
        page.drawRectangle({
          x: cx,
          y: page.getHeight() - y - th,
          width: mm(colW[j]),
          height: th,
          borderColor: rgb(0, 0, 0),
          borderWidth: 0.5,
        });
        page.drawText(B[j] ?? "", {
          x: cx + 2,
          y: page.getHeight() - y - th + 1,
          size: 7,
          font,
        });
        cx += mm(colW[j]);
      }
      y += th + mm(0.4);
    }
  }

  return doc;
}
