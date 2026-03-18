/**
 * Typy pro modul kontroly balení (Kontrola_*.py)
 */

export interface ControlRow {
  checked: boolean;
  serie: string;
  predcisli?: string;
  cisloOd: number;
  cisloDo: number;
  ks: number;
}

export interface ControlState {
  job: string;
  ksVKr: number;
  vyhoz: number;
  hotKrab: number;
  pocetRoli: number;
  celkem: number;
  rows: ControlRow[];
  cKrabNaPalete: number;
  paleta: number;
  cisloZakazky: string;
  turbo: boolean;
}

export interface PosunParams {
  direction: "zpet" | "vpred";
  step: 1 | 10 | 100 | 1000;
}
