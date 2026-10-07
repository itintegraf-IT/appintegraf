import { prisma } from "@/lib/db";

export type MaketaProductNotifyDetails = {
  labelCode: string | null;
  productName: string | null;
  productId: number | null;
  jobNumber: string | null;
};

function trimOrNull(value: string | null | undefined): string | null {
  const s = value?.trim();
  return s ? s : null;
}

/**
 * Kanonické údaje o produktu pro e-mailové / in-app notifikace makety.
 * Preferuje IML katalog (ig_code, client_name) a doplní z polí makety.
 */
export async function getMaketaProductNotifyDetails(
  maketaId: number
): Promise<MaketaProductNotifyDetails> {
  const maketa = await prisma.makety.findUnique({
    where: { id: maketaId },
    select: {
      product_id: true,
      label_code: true,
      product_name: true,
      job_number: true,
      iml_products: {
        select: {
          id: true,
          ig_code: true,
          client_name: true,
          ig_short_name: true,
        },
      },
    },
  });

  if (!maketa) {
    return {
      labelCode: null,
      productName: null,
      productId: null,
      jobNumber: null,
    };
  }

  const product = maketa.iml_products;
  const labelCode =
    trimOrNull(product?.ig_code) ?? trimOrNull(maketa.label_code);
  const productName =
    trimOrNull(maketa.product_name) ??
    trimOrNull(product?.client_name) ??
    trimOrNull(product?.ig_short_name);

  return {
    labelCode,
    productName,
    productId: maketa.product_id ?? product?.id ?? null,
    jobNumber: trimOrNull(maketa.job_number),
  };
}
