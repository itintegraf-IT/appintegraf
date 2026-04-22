import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { hasModuleAccess } from "@/lib/auth-utils";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";
import {
  Boxes,
  CircleCheckBig,
  Droplets,
  Layers,
  Printer,
  Settings2,
} from "lucide-react";
import ProductDetailView, {
  type ProductDetailSection,
} from "../_components/ProductDetailView";
import { consumptionKg } from "@/lib/iml-color-consumption";

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
        iml_product_colors: {
          include: {
            iml_pantone_colors: {
              select: { id: true, code: true, name: true, hex: true },
            },
          },
          orderBy: [{ sort_order: "asc" }, { id: "asc" }],
        },
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
          <InfoField label="Etiket na TA" value={fmtNum(product.labels_per_sheet)} />
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
      id: "colors",
      label: "Barvy",
      icon: <Droplets className="h-4 w-4" />,
      content:
        product.iml_product_colors.length > 0 ? (
          <ProductColorsTable
            colors={product.iml_product_colors.map((c) => ({
              code: c.iml_pantone_colors?.code ?? "",
              name: c.iml_pantone_colors?.name ?? null,
              hex: c.iml_pantone_colors?.hex ?? null,
              coverage_pct: Number(c.coverage_pct),
            }))}
            labelsPerSheet={product.labels_per_sheet ?? null}
          />
        ) : (
          <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-6 text-center text-sm text-gray-500">
            Zatím nejsou přiřazeny žádné Pantone barvy.
            {canWrite && (
              <>
                {" "}
                <a
                  href={`/iml/products/${product.id}/edit?tab=colors`}
                  className="font-medium text-red-700 underline hover:text-red-800"
                >
                  Přidat barvy
                </a>
                .
              </>
            )}
          </div>
        ),
    } as ProductDetailSection,
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

/**
 * Server-side (read-only) přehled Pantone barev produktu.
 * Zobrazuje kód, název, % pokrytí a orientační spotřebu pro referenční náklad.
 */
function ProductColorsTable({
  colors,
  labelsPerSheet,
}: {
  colors: Array<{
    code: string;
    name: string | null;
    hex: string | null;
    coverage_pct: number;
  }>;
  labelsPerSheet: number | null;
}) {
  const REF = 10_000;
  const totalCoverage = colors.reduce((s, c) => s + (Number.isFinite(c.coverage_pct) ? c.coverage_pct : 0), 0);
  return (
    <div className="space-y-3">
      {!labelsPerSheet && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
          Chybí <strong>Počet etiket na tiskový arch</strong> (tab Výseky) – doplňte pro výpočet spotřeby.
        </div>
      )}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-gray-600">
            <tr>
              <th className="px-3 py-2 font-medium w-10"></th>
              <th className="px-3 py-2 font-medium">Pantone</th>
              <th className="px-3 py-2 font-medium">Název</th>
              <th className="px-3 py-2 font-medium text-right">Pokrytí %</th>
              <th className="px-3 py-2 font-medium text-right">
                Spotřeba @ {REF.toLocaleString("cs-CZ")} ks
              </th>
            </tr>
          </thead>
          <tbody>
            {colors.map((c, i) => {
              const kg = consumptionKg(REF, labelsPerSheet, c.coverage_pct);
              return (
                <tr key={i} className="border-t">
                  <td className="px-3 py-2">
                    {c.hex && /^#[0-9A-Fa-f]{6}$/.test(c.hex) ? (
                      <span
                        className="inline-block h-5 w-5 rounded border border-gray-300"
                        style={{ backgroundColor: c.hex }}
                      />
                    ) : (
                      <span className="inline-block h-5 w-5 rounded border border-dashed border-gray-300" />
                    )}
                  </td>
                  <td className="px-3 py-2 font-mono">{c.code}</td>
                  <td className="px-3 py-2">{c.name ?? "—"}</td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {c.coverage_pct.toFixed(2)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {kg != null ? (
                      <span className="font-medium">{kg.toFixed(4)} kg</span>
                    ) : (
                      <span className="text-xs text-gray-400">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot className="bg-gray-50 text-xs text-gray-600">
            <tr>
              <td className="px-3 py-2" colSpan={3}>
                Součet pokrytí
              </td>
              <td className="px-3 py-2 text-right tabular-nums">
                {totalCoverage.toFixed(2)} %
              </td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
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
