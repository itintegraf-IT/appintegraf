import Link from "next/link";
import { Suspense } from "react";
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
import ProductImagePreview from "../_components/ProductImagePreview";
import ProductPdfHistory from "../_components/ProductPdfHistory";
import { consumptionKg } from "@/lib/iml-color-consumption";
import { imlProductHasPdfInFilesTable } from "@/lib/iml-product-pdf-flag";
import { productMaterialIncludes } from "@/lib/iml/product-materials";
import { imlLabelTypeLabel } from "@/lib/iml-constants";
import { formatProductFormatFromMm } from "@/lib/iml/product-format";
import { cmykFlagsFromProduct, formatPrintColorsSummaryForDisplay } from "@/lib/iml-print-colors-summary";
import { normalizePantoneCode, resolvePantoneSwatchHex } from "@/lib/iml-pantone";

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

  const [product, customFields, hasFileTablePdf] = await Promise.all([
    prisma.iml_products.findUnique({
      where: { id },
      include: {
        iml_customers: { select: { id: true, name: true } },
        iml_foils: { select: { id: true, code: true, name: true } },
        ...productMaterialIncludes,
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
    imlProductHasPdfInFilesTable(id),
  ]);

  if (!product) notFound();

  const codesNeedingHex = Array.from(
    new Set(
      product.iml_product_colors
        .map((c) => ({
          code: c.iml_pantone_colors?.code?.trim() ?? "",
          hex: c.iml_pantone_colors?.hex ?? null,
        }))
        .filter((c) => c.code && !resolvePantoneSwatchHex(c.code, c.hex))
        .map((c) => c.code)
    )
  );
  const hexByCode = new Map<string, string>();
  if (codesNeedingHex.length > 0) {
    const mats = await prisma.materials.findMany({
      where: {
        category_code: "COLOR",
        code: { in: codesNeedingHex },
        hex_color: { not: null },
      },
      select: { code: true, hex_color: true },
    });
    for (const m of mats) {
      if (!m.code || !m.hex_color) continue;
      hexByCode.set(normalizePantoneCode(m.code), m.hex_color);
      hexByCode.set(m.code.trim(), m.hex_color);
    }
  }

  const customData = (product.custom_data as Record<string, unknown> | null) ?? {};
  const hasCustomData = Object.keys(customData).length > 0;

  type CustomFieldRow = { id: number; field_key: string; label: string };
  const customFieldsTyped = customFields as CustomFieldRow[];

  const fmt = (v: unknown) => (v != null && v !== "" ? String(v) : "-");
  const fmtNum = (v: unknown) => (v != null ? String(v) : "-");
  const fmtDate = (v: unknown) => {
    if (v == null || v === "") return "-";
    const d = new Date(String(v));
    return Number.isNaN(d.getTime()) ? "-" : d.toLocaleDateString("cs-CZ");
  };
  const formatDisplay =
    formatProductFormatFromMm(
      product.format_width_mm != null ? Number(product.format_width_mm) : null,
      product.format_height_mm != null ? Number(product.format_height_mm) : null
    ) ?? fmt(product.product_format);
  const materialLabel = (m: { id: number; name: string; code: string | null } | null) => {
    if (!m) return null;
    const label = m.code ? `${m.name} (${m.code})` : m.name;
    return (
      <Link href={`/materialy/${m.id}`} className="text-red-600 hover:underline">
        {label}
      </Link>
    );
  };

  const foilDisplay =
    materialLabel(product.foil_material) ??
    (product.iml_foils ? `${product.iml_foils.code} — ${product.iml_foils.name}` : fmt(product.foil_type));

  const hasImage = !!(product.image_data && product.image_data.length > 0);
  const hasLegacyPdf = !!(product.pdf_data && product.pdf_data.length > 0);
  const hasPdf = hasLegacyPdf || hasFileTablePdf;
  const cmyk = cmykFlagsFromProduct(product);
  const hasPantoneColors = product.iml_product_colors.length > 0;
  const cmykActive = [cmyk.c && "C", cmyk.m && "M", cmyk.y && "Y", cmyk.k && "K"].filter(
    Boolean
  ) as string[];
  const cmykLabel = hasPantoneColors
    ? "Bez procesního CMYK (Pantone)"
    : cmykActive.length === 4
      ? "CMYK (plný proces)"
      : cmykActive.length > 0
        ? cmykActive.join(", ")
        : "Žádný CMYK kanál";

  const sections: ProductDetailSection[] = [
    {
      id: "id",
      label: "Identifikace",
      icon: <CircleCheckBig className="h-4 w-4" />,
      content: (
        <div>
          {(hasImage || hasPdf) && (
            <div className="mb-4 md:float-right md:ml-6 md:mb-2 md:w-60">
              <ProductImagePreview
                productId={product.id}
                hasImage={hasImage}
                hasPdf={hasPdf}
                className="h-60 w-full md:w-60"
              />
              <p className="mt-1 text-center text-xs text-gray-400">
                Kliknutím zvětšit{hasPdf ? " · detail z PDF" : ""}
              </p>
            </div>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <InfoField label="Kód IG" value={fmt(product.ig_code)} />
            <InfoField label="Zkrácený název" value={fmt(product.ig_short_name)} />
            <InfoField label="Kód u klienta" value={fmt(product.client_code)} />
            <InfoField label="Název u klienta" value={fmt(product.client_name)} />
            <InfoField label="Zákazník" value={product.iml_customers?.name ?? "-"} />
            <InfoField label="Zadavatel" value={fmt(product.requester)} />
            <InfoField label="SKU" value={fmt(product.sku)} mono />
          </div>
          <div className="clear-both" />
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
          <InfoField label="Kód výsekového nástroje" value={fmt(product.die_cut_tool_code)} />
          <InfoField label="Kód montáže" value={fmt(product.assembly_code)} />
          <InfoField label="Pozic na archu" value={fmtNum(product.positions_on_sheet)} />
          <InfoField label="Etiket na TA" value={fmtNum(product.labels_per_sheet)} />
          <InfoField label="Kusů v krabici" value={fmtNum(product.pieces_per_box)} />
          <InfoField label="Kusů na paletě" value={fmtNum(product.pieces_per_pallet)} />
          {product.die_cut_id != null && (
            <p className="sm:col-span-2 text-sm text-gray-500">
              Navázáno na katalog výseků (ID {product.die_cut_id}).{" "}
              <a href="/iml/die-cuts" className="text-red-600 hover:underline">
                Správa výseků
              </a>
            </p>
          )}
        </div>
      ),
    },
    {
      id: "material",
      label: "Materiály",
      icon: <Boxes className="h-4 w-4" />,
      content: (
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="text-sm text-gray-500">Papír</p>
            <p className="font-medium">{materialLabel(product.paper_material) ?? "-"}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Druh fólie</p>
            <p className="font-medium">{foilDisplay}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Barevnost / pokrytí</p>
            <p className="font-medium">
              {materialLabel(product.color_material) ?? fmt(product.color_coverage)}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Lak</p>
            <p className="font-medium">{materialLabel(product.lacquer_material) ?? "-"}</p>
          </div>
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
      content: (
        <div className="space-y-4">
          <div>
            <h4 className="mb-1 text-sm font-semibold text-gray-700">Procesní barvy (CMYK)</h4>
            <p className="text-sm text-gray-800">{cmykLabel}</p>
            {product.print_colors_text && (
              <p className="mt-1 text-xs text-gray-500">Souhrn: {product.print_colors_text}</p>
            )}
          </div>
          {product.iml_product_colors.length > 0 ? (
            <ProductColorsTable
              colors={product.iml_product_colors.map((c) => {
                const code = c.iml_pantone_colors?.code ?? "";
                const dbHex = c.iml_pantone_colors?.hex ?? null;
                const fromMaterials =
                  hexByCode.get(normalizePantoneCode(code)) ?? hexByCode.get(code.trim()) ?? null;
                return {
                  code,
                  name: c.iml_pantone_colors?.name ?? null,
                  hex: dbHex ?? fromMaterials,
                  coverage_pct: Number(c.coverage_pct),
                };
              })}
              labelsPerSheet={product.labels_per_sheet ?? null}
            />
          ) : (
            <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-4 text-center text-sm text-gray-500">
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
          )}
        </div>
      ),
    },
    {
      id: "print",
      label: "Tisková data",
      icon: <Printer className="h-4 w-4" />,
      content: (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <InfoField label="Stav schválení" value={fmt(product.approval_status)} />
            <InfoField label="Datum schválení" value={fmtDate(product.approval_date)} />
            <InfoField label="Stav položky" value={fmt(product.item_status)} />
            <InfoField label="Verze tiskových dat" value={fmt(product.print_data_version)} />
            <InfoField label="Skladem" value={fmtNum(product.stock_quantity)} />
            <InfoField label="Formát" value={formatDisplay} />
            <InfoField label="Počet barev" value={fmtNum(product.color_count)} />
            <InfoField label="Etiketa" value={imlLabelTypeLabel(product.label_type) || "-"} />
            {product.print_colors_text && (
              <InfoField
                label="Barvy (souhrn)"
                value={formatPrintColorsSummaryForDisplay(product.print_colors_text)}
                span={2}
              />
            )}
            <InfoField label="EAN kód" value={fmt(product.ean_code)} mono />
            <InfoField label="Vzor min. tisku" value={product.has_print_sample ? "Ano" : "Ne"} />
            <InfoField label="Nátisk" value={product.has_print_proof ? "Ano" : "Ne"} />
            <InfoField label="Naposledy editoval" value={fmt(product.last_edited_by)} />
            {product.realization_log && (
              <InfoField label="LOG realizací" value={product.realization_log} span={2} pre />
            )}
            {product.internal_note && (
              <InfoField label="Interní poznámka" value={product.internal_note} span={2} pre />
            )}
          </div>
          <div>
            <h4 className="mb-2 text-sm font-semibold text-gray-700">
              Historie verzí PDF
            </h4>
            <ProductPdfHistory productId={product.id} canWrite={canWrite} />
          </div>
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
    <Suspense fallback={<div className="p-8 text-center text-gray-500">Načítání…</div>}>
    <ProductDetailView
      title={title}
      subtitle={subtitle}
      productId={product.id}
      canWrite={canWrite}
      hasPdf={hasPdf}
      sections={sections}
    />
    </Suspense>
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
              const swatchHex = resolvePantoneSwatchHex(c.code, c.hex);
              return (
                <tr key={i} className="border-t">
                  <td className="px-3 py-2">
                    {swatchHex ? (
                      <span
                        className="inline-block h-5 w-5 rounded border border-gray-300"
                        style={{ backgroundColor: swatchHex }}
                        title={swatchHex}
                      />
                    ) : (
                      <span
                        className="inline-block h-5 w-5 rounded border border-dashed border-gray-300"
                        title="Barva není v číselníku (chybí hex)"
                      />
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
