export interface VarConfig {
  serie: string[];
  pocetCnaRoli: number;
  ksVKr: number;
  prvniRole: number;
  prvniJizd: number;
  prod: number;
  skip?: number;
  predcisli?: string[];
  cisloZakazky?: string;
}

export interface GenerateResult {
  success: boolean;
  csvPath?: string;
  txtPath?: string;
  error?: string;
  pocetVyhozu?: number;
}
