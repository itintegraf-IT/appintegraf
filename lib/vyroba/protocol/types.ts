/**
 * Typy pro protokoly a sestavy (Protokoly*.py)
 */

export interface ProtocolRow {
  serie: string;
  predcisli?: string;
  cisloOd: string;
  cisloDo: string;
  ks: number;
}

export interface BalnyListInput {
  job: string;
  cisloKrabice: string;
  cKrabNaPalete: string;
  balil: string;
  rows: ProtocolRow[];
}

export interface StitekInput {
  job: string;
  cisloKrabice: string;
  cKrabNaPalete: string;
  balil: string;
  serie: string;
  rows: ProtocolRow[];
}

export interface IgtPaletaInput {
  cisloZakazky: string;
  cisloPalety: string;
  boxes: Array<{
    cisloKrabice: string;
    cisloPalety: string;
    rows: ProtocolRow[];
  }>;
}

export interface IgtInkjetyInput {
  boxes: Array<{
    cisloKrabice: string;
    cisloPalety: string;
    serie: string;
    rows: ProtocolRow[];
  }>;
}
