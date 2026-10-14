import { prisma } from "@/lib/db";

export type MaketaProductNotifyDetails = {
  labelCode: string | null;
  productName: string | null;
  productId: number | null;
  jobNumber: string | null;
};

export type MaketaProductNotifySource = {
  product_id: number | null;
  label_code: string | null;
  product_name: string | null;
  job_number: string | null;
  iml_products: {
    id: number;
    ig_code: string | null;
    client_name: string | null;
    ig_short_name: string | null;
  } | null;
};

function trimOrNull(value: string | null | undefined): string | null {
  const s = value?.trim();
  return s ? s : null;
}

/**
 * Sestaví údaje o produktu pro notifikace.
 * Preferuje pole zakázky (makety); IML katalog jen jako fallback.
 */
export function resolveMaketaProductNotifyDetails(
  maketa: MaketaProductNotifySource
): MaketaProductNotifyDetails {
  const product = maketa.iml_products;
  const labelCode =
    trimOrNull(maketa.label_code) ?? trimOrNull(product?.ig_code);
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

/**
 * Kanonické údaje o produktu pro e-mailové / in-app notifikace makety.
 * Preferuje pole zakázky (label_code, product_name); katalog jen doplní chybějící.
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

  return resolveMaketaProductNotifyDetails(maketa);
}
