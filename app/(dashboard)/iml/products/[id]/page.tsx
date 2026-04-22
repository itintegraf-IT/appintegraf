import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { hasModuleAccess } from "@/lib/auth-utils";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";
import {
  Boxes,
  CircleCheckBig,
  Layers,
  Printer,
  Settings2,
} from "lucide-react";
import ProductDetailView, {
  type ProductDetailSection,
} from "../_components/ProductDetailView";

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

  const [product, customFields] = await Promise.all([
    prisma.iml_products.findUnique({
      where: { id },
      include: {
        iml_customers: { select: { id: true, name: true } },
        iml_foils: { select: { id: true, code: true, name: true } },
      },
    }),
    prisma.iml_custom_fields.findMany({
      where: { entity: "products", is_active: true },
      orderBy: { sort_order: "asc" },
    }),
  ]);

  if (!product) notFound();

  const customData = (product.custom_data as Record<string, unknown> | null) ?? {};
  const hasCustomData = Object.keys(customData).length > 0;

  type CustomFieldRow = { id: number; field_key: string; label: string };
  const customFieldsTyped = customFields as CustomFieldRow[];

  const fmt = (v: unknown) => (v != null && v !== "" ? String(v) : "-");
  const fmtNum = (v: unknown) => (v != null ? String(v) : "-");

  const hasImage = !!(product.image_data && product.image_data.length > 0);
  const hasPdf = !!(product.pdf_data && product.pdf_data.length > 0);

  const preview = hasImage || hasPdf ? (
    <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      <h3 className="mb-4 text-sm font-semibold text-gray-700">
        {hasImage ? "Náhled" : "Tisková data"}
      </h3>
      <div className="flex flex-wrap items-start gap-4">
        {hasImage && (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={`/api/iml/products/${product.id}/image`}
            alt="Náhled produktu"
            className="max-h-64 rounded-lg border border-gray-200 object-contain"
          />
        )}
        {hasPdf && (
          <a
            href={`/api/iml/products/${product.id}/pdf`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z"
                clipRule="evenodd"
              />
            </svg>
            Zobrazit PDF
          </a>
        )}
      </div>
    </div>
  ) : null;

  const sections: ProductDetailSection[] = [
    {
      id: "id",
      label: "Identifikace",
      icon: <CircleCheckBig className="h-4 w-4" />,
      content: (
        <div className="grid gap-4 sm:grid-cols-2">
          <InfoField label="Kód IG" value={fmt(product.ig_code)} />
          <InfoField label="Zkrácený název" value={fmt(product.ig_short_name)} />
          <InfoField label="Kód u klienta" value={fmt(product.client_code)} />
          <InfoField label="Název u klienta" value={fmt(product.client_name)} />
          <InfoField label="Zákazník" value={product.iml_customers?.name ?? "-"} />
          <InfoField label="Zadavatel" value={fmt(product.requester)} />
          <InfoField label="SKU" value={fmt(product.sku)} mono />
        </div>
      ),
    },
    {
      id: "cut",
      label: "Výseky",
      icon: <Layers className="h-4 w-4" />,
      content: (
        <div className="grid gap-4 sm:grid-cols-2">
          <InfoField label="Kód tvaru etikety" value={fmt(product.label_shape_code)} />
          <InfoField label="Rozměr / formát" value={fmt(product.product_format)} />
          <InfoField label="Kód výsekového nástroje" value={fmt(product.die_cut_tool_code)} />
          <InfoField label="Kód montáže" value={fmt(product.assembly_code)} />
          <InfoField label="Pozic na archu" value={fmtNum(product.positions_on_sheet)} />
          <InfoField label="Kusů v krabici" value={fmtNum(product.pieces_per_box)} />
          <InfoField label="Kusů na paletě" value={fmtNum(product.pieces_per_pallet)} />
        </div>
      ),
    },
    {
      id: "material",
      label: "Materiály",
      icon: <Boxes className="h-4 w-4" />,
      content: (
        <div className="grid gap-4 sm:grid-cols-2">
          <InfoField
            label="Druh fólie"
            value={
              product.iml_foils
                ? `${product.iml_foils.code} — ${product.iml_foils.name}`
                : fmt(product.foil_type)
            }
          />
          <InfoField label="Barevnost / pokrytí" value={fmt(product.color_coverage)} />
          <InfoField label="EAN kód" value={fmt(product.ean_code)} mono />
          <InfoField label="Vzor min. tisku" value={product.has_print_sample ? "Ano" : "Ne"} />
          {product.print_note && (
            <InfoField label="Poznámka k tisku" value={product.print_note} span={2} pre />
          )}
          {product.production_notes && (
            <InfoField label="Výrobní poznámky" value={product.production_notes} span={2} pre />
          )}
        </div>
      ),
    },
    {
      id: "print",
      label: "Tisková data",
      icon: <Printer className="h-4 w-4" />,
      content: (
        <div className="grid gap-4 sm:grid-cols-2">
          <InfoField label="Stav schválení" value={fmt(product.approval_status)} />
          <InfoField label="Stav položky" value={fmt(product.item_status)} />
          <InfoField label="Verze tiskových dat" value={fmt(product.print_data_version)} />
          <InfoField label="Skladem" value={fmtNum(product.stock_quantity)} />
          <InfoField label="Naposledy editoval" value={fmt(product.last_edited_by)} />
          {product.realization_log && (
            <InfoField label="LOG realizací" value={product.realization_log} span={2} pre />
          )}
          {product.internal_note && (
            <InfoField label="Interní poznámka" value={product.internal_note} span={2} pre />
          )}
        </div>
      ),
    },
  ];

  if (hasCustomData) {
    sections.push({
      id: "custom",
      label: "Vlastní pole",
      icon: <Settings2 className="h-4 w-4" />,
      content: (
        <div className="grid gap-4 sm:grid-cols-2">
          {customFieldsTyped.map((f) => {
            const val = customData[f.field_key];
            if (val === undefined || val === null || val === "") return null;
            return (
              <InfoField
                key={f.id}
                label={f.label}
                value={typeof val === "boolean" ? (val ? "Ano" : "Ne") : String(val)}
              />
            );
          })}
        </div>
      ),
    });
  }

  const title =
    product.client_name ?? product.ig_short_name ?? product.ig_code ?? `Produkt #${id}`;
  const subtitle = (
    <>
      {product.ig_code && <span className="font-mono">{product.ig_code}</span>}
      {product.iml_customers && ` • ${product.iml_customers.name}`}
    </>
  );

  return (
    <ProductDetailView
      title={title}
      subtitle={subtitle}
      productId={product.id}
      canWrite={canWrite}
      preview={preview}
      sections={sections}
    />
  );
}

function InfoField({
  label,
  value,
  span = 1,
  mono = false,
  pre = false,
}: {
  label: string;
  value: string;
  span?: 1 | 2;
  mono?: boolean;
  pre?: boolean;
}) {
  return (
    <div className={span === 2 ? "sm:col-span-2" : ""}>
      <p className="text-sm text-gray-500">{label}</p>
      <p
        className={
          (mono ? "font-mono " : "font-medium ") +
          (pre ? "whitespace-pre-wrap" : "")
        }
      >
        {value}
      </p>
    </div>
  );
}
