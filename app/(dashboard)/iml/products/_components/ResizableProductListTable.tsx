"use client";

import { useMemo, useState } from "react";
import { startColumnResize } from "@/lib/iml/product-list-column-resize";
import type { ProductListColumnId, ProductListColumnMeta, ProductListRow } from "@/lib/iml/product-list-columns";
import {
  renderProductListCell,
  type ProductListCellContext,
} from "./ProductListColumnCells";

type Props = {
  visibleColumns: ProductListColumnMeta[];
  columnWidths: Partial<Record<ProductListColumnId, number>>;
  loading: boolean;
  ready: boolean;
  products: ProductListRow[];
  cellContext: ProductListCellContext;
  onResizeColumn: (id: ProductListColumnId, width: number) => void;
  onResetColumnWidth: (id: ProductListColumnId) => void;
};

function headerAlignClass(align?: "left" | "center" | "right"): string {
  if (align === "center") return "text-center";
  if (align === "right") return "text-right";
  return "text-left";
}

function cellTitle(columnId: ProductListColumnId, product: ProductListRow): string | undefined {
  if (columnId === "name") {
    const v = product.client_name ?? product.ig_short_name;
    return v && v !== "-" ? v : undefined;
  }
  if (columnId === "customer") return product.iml_customers?.name ?? undefined;
  if (columnId === "print_colors_text") return product.print_colors_text ?? undefined;
  if (columnId === "die_cut_tool_code") return product.die_cut_tool_code ?? undefined;
  if (columnId === "foil") {
    const foil = product.iml_foils?.name ?? product.iml_foils?.code ?? product.foil_type;
    return foil ?? undefined;
  }
  return undefined;
}

export function ResizableProductListTable({
  visibleColumns,
  columnWidths,
  loading,
  ready,
  products,
  cellContext,
  onResizeColumn,
  onResetColumnWidth,
}: Props) {
  const colCount = visibleColumns.length;
  const [dragWidths, setDragWidths] = useState<Partial<Record<ProductListColumnId, number>>>({});

  const effectiveWidths = useMemo(
    () => ({ ...columnWidths, ...dragWidths }),
    [columnWidths, dragWidths]
  );

  const handleResizeStart = (col: ProductListColumnMeta, e: React.MouseEvent) => {
    if (col.resizable === false) return;
    e.preventDefault();
    e.stopPropagation();
    const startWidth = effectiveWidths[col.id] ?? col.defaultWidthPx;
    startColumnResize({
      columnId: col.id,
      startX: e.clientX,
      startWidth,
      onResize: (width) => setDragWidths((prev) => ({ ...prev, [col.id]: width })),
      onEnd: (width) => {
        setDragWidths((prev) => {
          const next = { ...prev };
          delete next[col.id];
          return next;
        });
        onResizeColumn(col.id, width);
      },
    });
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full table-fixed" style={{ minWidth: "100%" }}>
        <colgroup>
          {visibleColumns.map((col) => (
            <col key={col.id} style={{ width: effectiveWidths[col.id] ?? col.defaultWidthPx }} />
          ))}
        </colgroup>
        <thead className="border-b border-gray-200 bg-gray-50">
          <tr>
            {visibleColumns.map((col) => (
              <th
                key={col.id}
                className={`relative px-4 py-3 text-sm font-semibold text-gray-700 ${headerAlignClass(col.align)} ${col.headerClassName ?? ""}`}
              >
                <span className="block truncate pr-2">{col.label}</span>
                {col.resizable !== false && (
                  <span
                    role="separator"
                    aria-orientation="vertical"
                    aria-label={`Změnit šířku sloupce ${col.label}`}
                    className="absolute right-0 top-0 z-10 h-full w-1.5 cursor-col-resize hover:bg-red-200/80 active:bg-red-300/80"
                    onMouseDown={(e) => handleResizeStart(col, e)}
                    onDoubleClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      onResetColumnWidth(col.id);
                    }}
                    title="Tažením změníte šířku, dvojklik obnoví výchozí"
                  />
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {loading || !ready ? (
            <tr>
              <td colSpan={colCount || 1} className="px-4 py-8 text-center text-gray-500">
                Načítání…
              </td>
            </tr>
          ) : products.length === 0 ? (
            <tr>
              <td colSpan={colCount || 1} className="px-4 py-8 text-center text-gray-500">
                Žádné produkty
              </td>
            </tr>
          ) : (
            products.map((p) => (
              <tr key={p.id} className="border-b border-gray-100 hover:bg-gray-50">
                {visibleColumns.map((col) => {
                  const truncate = col.truncate;
                  const title = truncate ? cellTitle(col.id, p) : undefined;
                  return (
                    <td
                      key={col.id}
                      title={title}
                      className={`px-4 py-3 ${headerAlignClass(col.align)} ${col.cellClassName ?? ""} ${truncate ? "overflow-hidden text-ellipsis whitespace-nowrap" : ""}`}
                    >
                      {renderProductListCell(col.id, p, cellContext)}
                    </td>
                  );
                })}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
