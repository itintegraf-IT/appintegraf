"use client";

import Link from "next/link";
import { Eye, Pencil, Trash2, FileText, ImageOff } from "lucide-react";
import { withReturnTo } from "@/lib/navigation/return-to";
import {
  formatProductListDate,
  formatProductListFormat,
  formatProductListFoil,
  type ProductListColumnId,
  type ProductListRow,
} from "@/lib/iml/product-list-columns";
import { imlProductKindLabel } from "@/lib/iml-constants";

export type ProductListCellContext = {
  canWrite: boolean;
  listHref: string;
  onDelete: (id: number, name: string) => void;
};

function ProductListThumbnail({ product }: { product: ProductListRow }) {
  if (product.has_image) {
    return (
      /* eslint-disable-next-line @next/next/no-img-element */
      <img
        src={`/api/iml/products/${product.id}/image`}
        alt=""
        className="h-10 w-10 rounded border border-gray-200 bg-white object-contain"
        loading="lazy"
      />
    );
  }

  if (product.has_pdf) {
    return (
      <div
        className="flex h-10 w-10 items-center justify-center rounded border border-dashed border-gray-200 bg-gray-50 text-gray-400"
        title="Bez miniatury – otevřete detail nebo spusťte doplnění miniatur"
      >
        <FileText className="h-4 w-4" />
      </div>
    );
  }

  return (
    <div
      className="flex h-10 w-10 items-center justify-center rounded border border-dashed border-gray-200 bg-gray-50 text-gray-300"
      title="Bez obrázku"
    >
      <ImageOff className="h-4 w-4" />
    </div>
  );
}

function dash(value: string | number | null | undefined): string {
  if (value == null || value === "") return "-";
  return String(value);
}

export function renderProductListCell(
  columnId: ProductListColumnId,
  product: ProductListRow,
  ctx: ProductListCellContext
) {
  switch (columnId) {
    case "thumbnail":
      return <ProductListThumbnail product={product} />;
    case "ig_code":
      return <span className="font-mono text-sm">{product.ig_code ?? "-"}</span>;
    case "name":
      return product.client_name ?? product.ig_short_name ?? "-";
    case "customer":
      return <span className="text-gray-600">{product.iml_customers?.name ?? "-"}</span>;
    case "product_kind":
      return (
        <span className="rounded bg-gray-100 px-2 py-0.5 text-xs">
          {imlProductKindLabel(product.product_kind)}
        </span>
      );
    case "status":
      return (
        <span className="rounded bg-gray-100 px-2 py-0.5 text-sm">{product.item_status ?? "-"}</span>
      );
    case "pdf":
      return product.has_pdf ? (
        <a
          href={`/api/iml/products/${product.id}/pdf`}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="inline-flex h-8 w-8 items-center justify-center rounded text-red-600 hover:bg-red-50"
          title="Otevřít PDF tisková data"
        >
          <FileText className="h-5 w-5" />
        </a>
      ) : (
        <span className="text-gray-300" title="Bez tiskových dat">
          <FileText className="mx-auto h-5 w-5 opacity-30" />
        </span>
      );
    case "actions":
      return (
        <div className="flex justify-end gap-1">
          <Link
            href={withReturnTo(`/iml/products/${product.id}`, ctx.listHref)}
            className="rounded p-2 text-gray-600 hover:bg-gray-100"
            title="Detail"
          >
            <Eye className="h-4 w-4" />
          </Link>
          {ctx.canWrite && (
            <>
              <Link
                href={withReturnTo(`/iml/products/${product.id}/edit`, ctx.listHref)}
                className="rounded p-2 text-gray-600 hover:bg-gray-100"
                title="Upravit"
              >
                <Pencil className="h-4 w-4" />
              </Link>
              <button
                type="button"
                onClick={() =>
                  ctx.onDelete(product.id, product.client_name ?? product.ig_short_name ?? "")
                }
                className="rounded p-2 text-red-600 hover:bg-red-50"
                title="Smazat"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </>
          )}
        </div>
      );
    case "sku":
      return dash(product.sku);
    case "client_code":
      return dash(product.client_code);
    case "ig_short_name":
      return dash(product.ig_short_name);
    case "requester":
      return dash(product.requester);
    case "ean_code":
      return dash(product.ean_code);
    case "die_cut_tool_code":
      return dash(product.die_cut_tool_code);
    case "label_shape_code":
      return dash(product.label_shape_code);
    case "assembly_code":
      return dash(product.assembly_code);
    case "positions_on_sheet":
      return dash(product.positions_on_sheet);
    case "labels_per_sheet":
      return dash(product.labels_per_sheet);
    case "format":
      return formatProductListFormat(product);
    case "print_colors_text":
      return dash(product.print_colors_text);
    case "color_count":
      return dash(product.color_count);
    case "color_coverage":
      return dash(product.color_coverage);
    case "foil":
      return formatProductListFoil(product);
    case "stock_quantity":
      return dash(product.stock_quantity);
    case "approval_status":
      return dash(product.approval_status);
    case "approval_date":
      return formatProductListDate(product.approval_date);
    case "updated_at":
      return formatProductListDate(product.updated_at);
    default:
      return "-";
  }
}
