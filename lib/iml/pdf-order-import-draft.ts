/** Draft PDF importu objednávky v sessionStorage (návrat ze založení produktu). */

export const PDF_ORDER_IMPORT_DRAFT_KEY = "iml-pdf-order-import-draft";
export const PDF_ORDER_IMPORT_DRAFT_TTL_MS = 24 * 60 * 60 * 1000;
export const PDF_ORDER_IMPORT_DRAFT_VERSION = 1 as const;

export const PDF_ORDER_IMPORT_RETURN_PATH = "/iml/orders/import?mode=pdf";

export type PdfOrderImportDraftRow = {
  itemNo: string;
  description: string;
  customerMaterialNo: string | null;
  yourMaterialNo: string | null;
  deliveryDate: string | null;
  quantity: string;
  subtotal: string;
  productId: string;
  productLabel: string | null;
  matchedBy: "client_code" | "ig_code" | null;
  source: "pdf" | "manual";
};

export type PdfOrderImportDraftPreview = {
  template: string;
  order: {
    orderNumber: string;
    orderDate: string | null;
    expectedShipDate: string | null;
    currency: string | null;
    notes: string;
    totalAmount: number | null;
  };
  duplicate: boolean;
  suggestedCustomer: { id: number; name: string } | null;
  items: unknown[];
  warnings: string[];
};

export type PdfOrderImportDraft = {
  version: typeof PDF_ORDER_IMPORT_DRAFT_VERSION;
  savedAt: string;
  templateKey: string;
  form: {
    job_number: string;
    order_number: string;
    order_date: string;
    expected_ship_date: string;
    customer_id: string;
    notes: string;
  };
  confirmedWithoutJobNumber: boolean;
  rows: PdfOrderImportDraftRow[];
  preview: PdfOrderImportDraftPreview;
  warnings: string[];
  duplicate: boolean;
  /** itemNo ručního řádku čekajícího na nový produkt */
  pendingManualItemNo: string | null;
};

function canUseSessionStorage(): boolean {
  return typeof window !== "undefined" && typeof sessionStorage !== "undefined";
}

export function savePdfOrderImportDraft(
  draft: Omit<PdfOrderImportDraft, "version" | "savedAt"> & {
    version?: number;
    savedAt?: string;
  }
): void {
  if (!canUseSessionStorage()) return;
  const payload: PdfOrderImportDraft = {
    ...draft,
    version: PDF_ORDER_IMPORT_DRAFT_VERSION,
    savedAt: new Date().toISOString(),
  };
  try {
    sessionStorage.setItem(PDF_ORDER_IMPORT_DRAFT_KEY, JSON.stringify(payload));
  } catch {
    /* quota / private mode */
  }
}

export function loadPdfOrderImportDraft(): PdfOrderImportDraft | null {
  if (!canUseSessionStorage()) return null;
  try {
    const raw = sessionStorage.getItem(PDF_ORDER_IMPORT_DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PdfOrderImportDraft;
    if (!parsed || parsed.version !== PDF_ORDER_IMPORT_DRAFT_VERSION) {
      clearPdfOrderImportDraft();
      return null;
    }
    if (!parsed.preview || !Array.isArray(parsed.rows) || !parsed.form) {
      clearPdfOrderImportDraft();
      return null;
    }
    const savedAt = Date.parse(parsed.savedAt);
    if (!Number.isFinite(savedAt) || Date.now() - savedAt > PDF_ORDER_IMPORT_DRAFT_TTL_MS) {
      clearPdfOrderImportDraft();
      return null;
    }
    return parsed;
  } catch {
    clearPdfOrderImportDraft();
    return null;
  }
}

export function clearPdfOrderImportDraft(): void {
  if (!canUseSessionStorage()) return;
  try {
    sessionStorage.removeItem(PDF_ORDER_IMPORT_DRAFT_KEY);
  } catch {
    /* ignore */
  }
}

/** Připojí createdProductId k return URL (import). */
export function appendCreatedProductIdToReturn(
  returnPath: string,
  productId: number
): string {
  const [pathAndQuery, hash = ""] = returnPath.split("#");
  const qIndex = pathAndQuery.indexOf("?");
  const pathname = qIndex >= 0 ? pathAndQuery.slice(0, qIndex) : pathAndQuery;
  const params = new URLSearchParams(qIndex >= 0 ? pathAndQuery.slice(qIndex + 1) : "");
  params.set("createdProductId", String(productId));
  const query = params.toString();
  const built = query ? `${pathname}?${query}` : pathname;
  return hash ? `${built}#${hash}` : built;
}
