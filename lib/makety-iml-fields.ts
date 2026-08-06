import { prisma } from "@/lib/db";

export type MaketyImlFields = {
  customer_id: number | null;
  product_id: number | null;
  die_cut_id: number | null;
  label_code: string | null;
  job_number: string | null;
};

function parseOptionalId(raw: unknown): number | null | "invalid" {
  if (raw === null || raw === undefined || raw === "") return null;
  const n = parseInt(String(raw), 10);
  if (Number.isNaN(n) || n < 1) return "invalid";
  return n;
}

function parseOptionalText(raw: unknown, maxLen: number): string | null {
  if (raw === null || raw === undefined) return null;
  const s = String(raw).trim();
  if (!s) return null;
  return s.slice(0, maxLen);
}

/** Načte IML vazby z FormData (POST) nebo JSON body (PUT). */
export function parseMaketyImlFieldsFromInput(input: {
  get: (key: string) => FormDataEntryValue | null;
} | Record<string, unknown>): MaketyImlFields | { error: string } {
  const read = (key: string): unknown => {
    if (typeof (input as { get?: unknown }).get === "function") {
      return (input as FormData).get(key);
    }
    return (input as Record<string, unknown>)[key];
  };

  const customerRaw = parseOptionalId(read("customer_id"));
  if (customerRaw === "invalid") return { error: "Neplatný klient" };
  const productRaw = parseOptionalId(read("product_id"));
  if (productRaw === "invalid") return { error: "Neplatná etiketa" };
  const dieCutRaw = parseOptionalId(read("die_cut_id"));
  if (dieCutRaw === "invalid") return { error: "Neplatný výsek" };

  return {
    customer_id: customerRaw,
    product_id: productRaw,
    die_cut_id: dieCutRaw,
    label_code: parseOptionalText(read("label_code"), 100),
    job_number: parseOptionalText(read("job_number"), 50),
  };
}

/**
 * Ověří vazby na IML katalog a případně doplní label_code / die_cut_id z produktu.
 * Pro work_type !== grafika vrací null hodnoty.
 */
export async function resolveMaketyImlFields(
  workType: string,
  fields: MaketyImlFields
): Promise<MaketyImlFields | { error: string }> {
  if (workType !== "grafika") {
    return {
      customer_id: null,
      product_id: null,
      die_cut_id: null,
      label_code: null,
      job_number: null,
    };
  }

  let { customer_id, product_id, die_cut_id, label_code, job_number } = fields;

  if (customer_id != null) {
    const customer = await prisma.iml_customers.findFirst({
      where: { id: customer_id },
      select: { id: true },
    });
    if (!customer) return { error: "Vybraný klient neexistuje" };
  }

  if (product_id != null) {
    const product = await prisma.iml_products.findFirst({
      where: { id: product_id },
      select: {
        id: true,
        customer_id: true,
        ig_code: true,
        client_code: true,
        ean_code: true,
        die_cut_id: true,
      },
    });
    if (!product) return { error: "Vybraná etiketa neexistuje" };
    if (customer_id != null && product.customer_id != null && product.customer_id !== customer_id) {
      return { error: "Etiketa nepatří k vybranému klientovi" };
    }
    if (customer_id == null && product.customer_id != null) {
      customer_id = product.customer_id;
    }
    if (!label_code) {
      label_code =
        product.ig_code?.trim() ||
        product.client_code?.trim() ||
        product.ean_code?.trim() ||
        null;
    }
    if (die_cut_id == null && product.die_cut_id != null) {
      die_cut_id = product.die_cut_id;
    }
  }

  if (die_cut_id != null) {
    const dieCut = await prisma.iml_die_cuts.findFirst({
      where: { id: die_cut_id },
      select: { id: true, customer_id: true, is_active: true },
    });
    if (!dieCut) return { error: "Vybraný výsek neexistuje" };
    if (
      customer_id != null &&
      dieCut.customer_id != null &&
      dieCut.customer_id !== customer_id
    ) {
      return { error: "Výsek nepatří k vybranému klientovi" };
    }
  }

  if ((product_id != null || die_cut_id != null || label_code) && customer_id == null) {
    return { error: "Nejprve vyberte klienta" };
  }

  return { customer_id, product_id, die_cut_id, label_code, job_number };
}
