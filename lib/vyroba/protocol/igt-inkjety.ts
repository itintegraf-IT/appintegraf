/**
 * TXT pro jehličkovou tiskárnu EPSON FX – podle Protokoly_IGT_Sazka.py Stitek_Krabice
 * Formát pro inkjetové označení krabic
 */
import { IgtInkjetyInput } from "./types";

const x1 = 30;
const x2 = 93;

export function createIgtInkjetyTxt(input: IgtInkjetyInput): string {
  let IP = "";
  let Row = "";

  for (const box of input.boxes) {
    const cisloKrabice = String(box.cisloKrabice).padStart(6, "0");
    const { serie, rows } = box;

    let zacatek = 0;
    let konec = 999999999;
    let celkvRolich = 0;

    for (const pol of rows) {
      const ciselvRoli = parseInt(pol.cisloDo.replace(/\s/g, ""), 10) - parseInt(pol.cisloOd.replace(/\s/g, ""), 10);
      const odNum = parseInt(pol.cisloOd.replace(/\s/g, ""), 10);
      const doNum = parseInt(pol.cisloDo.replace(/\s/g, ""), 10);
      if (odNum < konec) konec = odNum;
      if (doNum > zacatek) zacatek = doNum;
      celkvRolich += ciselvRoli;
      Row += `${pol.cisloOd}-${pol.cisloDo}${" ".repeat(x2)}${ciselvRoli}\n`;
    }

    const mnozstvi = String(rows.length);
    IP += " ".repeat(x1) + cisloKrabice + " ".repeat(75) + "5,40 kg\n";
    IP += " ".repeat(x1) + String(zacatek) + "\n";
    IP += " ".repeat(x1) + String(konec) + "\n\n";
    IP += " ".repeat(x1) + serie + "\n\n";
    IP += Row + "\n";
    IP += " ".repeat(36) + mnozstvi + " ".repeat(86) + String(celkvRolich) + "\n";
    IP += "\n".repeat(17);
    Row = "";
  }

  return IP;
}
