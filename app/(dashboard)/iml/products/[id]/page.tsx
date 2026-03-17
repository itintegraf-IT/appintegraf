import { notFound } from "next/navigation";
import Link from "next/link";
import { auth } from "@/auth";
import { hasModuleAccess } from "@/lib/auth-utils";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";

export default async function ImlProductDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const userId = parseInt(session.user.id, 10);
  const canRead = await hasModuleAccess(userId, "iml", "read");
  const canWrite = await hasModuleAccess(userId, "iml", "write");

  if (!canRead) redirect("/iml");

  const id = parseInt((await params).id, 10);
  if (isNaN(id)) notFound();

  const product = await prisma.iml_products.findUnique({
    where: { id },
    include: { iml_customers: { select: { id: true, name: true } } },
  });

  if (!product) notFound();

  const fmt = (v: unknown) => (v != null && v !== "" ? String(v) : "-");
  const fmtNum = (v: unknown) => (v != null ? String(v) : "-");

  return (
    <>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {product.client_name ?? product.ig_short_name ?? product.ig_code ?? `Produkt #${id}`}
          </h1>
          <p className="mt-1 text-gray-600">
            {product.ig_code && <span className="font-mono">{product.ig_code}</span>}
            {product.iml_customers && ` • ${product.iml_customers.name}`}
          </p>
        </div>
        <div className="flex gap-2">
          {canWrite && (
            <Link
              href={`/iml/products/${product.id}/edit`}
              className="rounded-lg border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50"
            >
              Upravit
            </Link>
          )}
          <Link
            href="/iml/products"
            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50"
          >
            <ArrowLeft className="h-4 w-4" />
            Zpět
          </Link>
        </div>
      </div>

      <div className="space-y-6">
        {(product.image_data && product.image_data.length > 0) && (
          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <h3 className="mb-4 text-sm font-semibold text-gray-700">Náhled</h3>
            <div className="flex flex-wrap items-start gap-4">
              <img
                src={`/api/iml/products/${product.id}/image`}
                alt="Náhled produktu"
                className="max-h-64 rounded-lg border border-gray-200 object-contain"
              />
              {product.pdf_data && product.pdf_data.length > 0 && (
                <a
                  href={`/api/iml/products/${product.id}/pdf`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
                  </svg>
                  Zobrazit PDF
                </a>
              )}
            </div>
          </div>
        )}
        {(!product.image_data || product.image_data.length === 0) && product.pdf_data && product.pdf_data.length > 0 && (
          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <h3 className="mb-4 text-sm font-semibold text-gray-700">Tisková data</h3>
            <a
              href={`/api/iml/products/${product.id}/pdf`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
              </svg>
              Zobrazit PDF
            </a>
          </div>
        )}
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h3 className="mb-4 text-sm font-semibold text-gray-700">Identifikace</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <div><p className="text-sm text-gray-500">Kód IG</p><p className="font-medium">{fmt(product.ig_code)}</p></div>
            <div><p className="text-sm text-gray-500">Zkrácený název</p><p className="font-medium">{fmt(product.ig_short_name)}</p></div>
            <div><p className="text-sm text-gray-500">Kód u klienta</p><p className="font-medium">{fmt(product.client_code)}</p></div>
            <div><p className="text-sm text-gray-500">Název u klienta</p><p className="font-medium">{fmt(product.client_name)}</p></div>
            <div><p className="text-sm text-gray-500">Zákazník</p><p className="font-medium">{product.iml_customers?.name ?? "-"}</p></div>
            <div><p className="text-sm text-gray-500">Zadavatel</p><p className="font-medium">{fmt(product.requester)}</p></div>
            <div><p className="text-sm text-gray-500">SKU</p><p className="font-mono">{fmt(product.sku)}</p></div>
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h3 className="mb-4 text-sm font-semibold text-gray-700">Výseky a montáže</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <div><p className="text-sm text-gray-500">Kód tvaru etikety</p><p className="font-medium">{fmt(product.label_shape_code)}</p></div>
            <div><p className="text-sm text-gray-500">Rozměr / formát</p><p className="font-medium">{fmt(product.product_format)}</p></div>
            <div><p className="text-sm text-gray-500">Kód výsekového nástroje</p><p className="font-medium">{fmt(product.die_cut_tool_code)}</p></div>
            <div><p className="text-sm text-gray-500">Kód montáže</p><p className="font-medium">{fmt(product.assembly_code)}</p></div>
            <div><p className="text-sm text-gray-500">Pozic na archu</p><p className="font-medium">{fmtNum(product.positions_on_sheet)}</p></div>
            <div><p className="text-sm text-gray-500">Kusů v krabici</p><p className="font-medium">{fmtNum(product.pieces_per_box)}</p></div>
            <div><p className="text-sm text-gray-500">Kusů na paletě</p><p className="font-medium">{fmtNum(product.pieces_per_pallet)}</p></div>
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h3 className="mb-4 text-sm font-semibold text-gray-700">Materiály a tisk</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <div><p className="text-sm text-gray-500">Druh fólie</p><p className="font-medium">{fmt(product.foil_type)}</p></div>
            <div><p className="text-sm text-gray-500">Barevnost / pokrytí</p><p className="font-medium">{fmt(product.color_coverage)}</p></div>
            <div><p className="text-sm text-gray-500">EAN kód</p><p className="font-mono">{fmt(product.ean_code)}</p></div>
            <div><p className="text-sm text-gray-500">Vzor min. tisku</p><p className="font-medium">{product.has_print_sample ? "Ano" : "Ne"}</p></div>
            {product.print_note && (
              <div className="sm:col-span-2"><p className="text-sm text-gray-500">Poznámka k tisku</p><p className="whitespace-pre-wrap">{product.print_note}</p></div>
            )}
            {product.production_notes && (
              <div className="sm:col-span-2"><p className="text-sm text-gray-500">Výrobní poznámky</p><p className="whitespace-pre-wrap">{product.production_notes}</p></div>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h3 className="mb-4 text-sm font-semibold text-gray-700">Schvalování a metadata</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <div><p className="text-sm text-gray-500">Stav schválení</p><p className="font-medium">{fmt(product.approval_status)}</p></div>
            <div><p className="text-sm text-gray-500">Stav položky</p><p className="font-medium">{fmt(product.item_status)}</p></div>
            <div><p className="text-sm text-gray-500">Verze tiskových dat</p><p className="font-medium">{fmt(product.print_data_version)}</p></div>
            <div><p className="text-sm text-gray-500">Skladem</p><p className="font-medium">{fmtNum(product.stock_quantity)}</p></div>
            <div><p className="text-sm text-gray-500">Naposledy editoval</p><p className="font-medium">{fmt(product.last_edited_by)}</p></div>
            {product.realization_log && (
              <div className="sm:col-span-2"><p className="text-sm text-gray-500">LOG realizací</p><p className="whitespace-pre-wrap">{product.realization_log}</p></div>
            )}
            {product.internal_note && (
              <div className="sm:col-span-2"><p className="text-sm text-gray-500">Interní poznámka</p><p className="whitespace-pre-wrap">{product.internal_note}</p></div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
