/** Typy pro import objednávek IML z PDF (šablony parserů dle zákazníka). */

export type ParsedPdfOrderItem = {
  /** Číslo položky z PDF (např. "00010"). */
  itemNo: string;
  description: string;
  /** Material No zákazníka (např. Orkla 219010549) – páruje se na client_code. */
  customerMaterialNo: string | null;
  /** "Your Material No" = interní číslo Integraf – fallback párování na ig_code. */
  yourMaterialNo: string | null;
  /** Množství v kusech (PDF "4.000 PCS" = 4000 ks). */
  quantity: number | null;
  /** Cena z PDF vztažená k priceBasis (typicky za 1000 ks). */
  price: number | null;
  /** Základ ceny v ks ("Per 1000 PCS" → 1000). */
  priceBasis: number;
  /** Net Amount z PDF – přesný mezisoučet položky. */
  netAmount: number | null;
  /** Datum dodání (ISO yyyy-mm-dd). */
  deliveryDate: string | null;
};

export type ParsedPdfOrder = {
  orderNumber: string;
  /** ISO yyyy-mm-dd. */
  orderDate: string | null;
  currency: string | null;
  items: ParsedPdfOrderItem[];
  /** Volný text z PDF (pokyny k tisku, dodání apod.). */
  notes: string;
  totalAmount: number | null;
  warnings: string[];
};

export type OrderPdfTemplate = {
  key: string;
  label: string;
  /** Podřetězec pro návrh zákazníka podle iml_customers.name. */
  customerHint: string;
  /** Rozpozná, zda text PDF odpovídá této šabloně (pro automatickou volbu). */
  detect: (text: string) => boolean;
  parse: (text: string) => ParsedPdfOrder;
};
