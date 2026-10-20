"use client";

import { useMemo, useState, type CSSProperties, type ReactNode } from "react";
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  horizontalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ArrowDown, ArrowUp, ArrowUpDown, GripVertical } from "lucide-react";
import { startColumnResize } from "@/lib/iml/product-list-column-resize";
import {
  isProductListColumnDraggable,
  isProductListColumnSortable,
  type ProductListColumnId,
  type ProductListColumnMeta,
  type ProductListRow,
} from "@/lib/iml/product-list-columns";
import type { ProductListSortDir } from "@/lib/iml/product-list-sort";
import { IML_ITEM_STATUS_DATA_CHANGE } from "@/lib/iml-constants";
import {
  renderProductListCell,
  type ProductListCellContext,
} from "./ProductListColumnCells";

type Props = {
  visibleColumns: ProductListColumnMeta[];
  columnWidths: Partial<Record<ProductListColumnId, number>>;
  loading: boolean;
  loadingMore?: boolean;
  ready: boolean;
  products: ProductListRow[];
  cellContext: ProductListCellContext;
  onResizeColumn: (id: ProductListColumnId, width: number) => void;
  onResetColumnWidth: (id: ProductListColumnId) => void;
  footer?: ReactNode;
  selectionEnabled?: boolean;
  selectedIds?: Set<number>;
  onToggleSelect?: (id: number) => void;
  onToggleSelectAllPage?: () => void;
  sortColumn?: string;
  sortDir?: ProductListSortDir | "";
  onCycleSort?: (columnId: ProductListColumnId) => void;
  onReorderColumns?: (activeId: ProductListColumnId, overId: ProductListColumnId) => void;
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

function SortHeaderButton({
  sortDir,
  onCycle,
}: {
  sortDir: ProductListSortDir | null;
  onCycle: () => void;
}) {
  const SortIcon = sortDir === "asc" ? ArrowUp : sortDir === "desc" ? ArrowDown : ArrowUpDown;
  const sortTitle =
    sortDir === "asc"
      ? "Řazení: vzestupně (kliknutím sestupně)"
      : sortDir === "desc"
        ? "Řazení: sestupně (kliknutím vypnout)"
        : "Řadit vzestupně";
  return (
    <button
      type="button"
      onClick={onCycle}
      onPointerDown={(e) => e.stopPropagation()}
      className={`rounded p-0.5 hover:bg-red-100 ${
        sortDir ? "text-red-700" : "text-gray-400 hover:text-gray-600"
      }`}
      title={sortTitle}
      aria-label={sortTitle}
    >
      <SortIcon className="h-3.5 w-3.5" />
    </button>
  );
}

function SortableHeaderCell({
  column,
  effectiveWidth,
  sortDir,
  onCycleSort,
  onResizeStart,
  onResetColumnWidth,
}: {
  column: ProductListColumnMeta;
  effectiveWidth: number;
  sortDir: ProductListSortDir | null;
  onCycleSort?: (id: ProductListColumnId) => void;
  onResizeStart: (col: ProductListColumnMeta, e: React.MouseEvent) => void;
  onResetColumnWidth: (id: ProductListColumnId) => void;
}) {
  const draggable = isProductListColumnDraggable(column.id);
  const sortable = isProductListColumnSortable(column.id);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: column.id,
    disabled: !draggable,
  });

  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    width: effectiveWidth,
  };

  return (
    <th
      ref={setNodeRef}
      style={style}
      className={`relative px-4 py-3 text-sm font-semibold text-gray-700 ${headerAlignClass(column.align)} ${column.headerClassName ?? ""}`}
    >
      <div className="flex items-center gap-1 pr-2">
        {draggable ? (
          <button
            type="button"
            className="cursor-grab touch-none rounded p-0.5 text-gray-400 hover:bg-gray-200 hover:text-gray-600 active:cursor-grabbing"
            aria-label={`Přesunout sloupec ${column.label}`}
            {...attributes}
            {...listeners}
          >
            <GripVertical className="h-3.5 w-3.5" />
          </button>
        ) : (
          <span className="w-5 shrink-0" aria-hidden />
        )}
        <span className="min-w-0 flex-1 truncate">{column.label}</span>
        {sortable && onCycleSort ? (
          <SortHeaderButton sortDir={sortDir} onCycle={() => onCycleSort(column.id)} />
        ) : null}
      </div>
      {column.resizable !== false && (
        <span
          role="separator"
          aria-orientation="vertical"
          aria-label={`Změnit šířku sloupce ${column.label}`}
          className="absolute right-0 top-0 z-10 h-full w-1.5 cursor-col-resize hover:bg-red-200/80 active:bg-red-300/80"
          onMouseDown={(e) => onResizeStart(column, e)}
          onDoubleClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onResetColumnWidth(column.id);
          }}
          title="Tažením změníte šířku, dvojklik obnoví výchozí"
        />
      )}
    </th>
  );
}

export function ResizableProductListTable({
  visibleColumns,
  columnWidths,
  loading,
  loadingMore = false,
  ready,
  products,
  cellContext,
  onResizeColumn,
  onResetColumnWidth,
  footer,
  selectionEnabled = false,
  selectedIds,
  onToggleSelect,
  onToggleSelectAllPage,
  sortColumn = "",
  sortDir = "",
  onCycleSort,
  onReorderColumns,
}: Props) {
  const colCount = visibleColumns.length + (selectionEnabled ? 1 : 0);
  const allPageSelected =
    selectionEnabled &&
    products.length > 0 &&
    products.every((p) => selectedIds?.has(p.id));
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

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  );

  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id || !onReorderColumns) return;
    onReorderColumns(active.id as ProductListColumnId, over.id as ProductListColumnId);
  };

  const sortableIds = visibleColumns
    .filter((c) => isProductListColumnDraggable(c.id))
    .map((c) => c.id);

  return (
    <div className="overflow-x-auto">
      <table className="w-full table-fixed" style={{ minWidth: "100%" }}>
        <colgroup>
          {selectionEnabled && <col style={{ width: 40 }} />}
          {visibleColumns.map((col) => (
            <col key={col.id} style={{ width: effectiveWidths[col.id] ?? col.defaultWidthPx }} />
          ))}
        </colgroup>
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={sortableIds} strategy={horizontalListSortingStrategy}>
            <thead className="border-b border-gray-200 bg-gray-50">
              <tr>
                {selectionEnabled && (
                  <th className="px-2 py-3">
                    <input
                      type="checkbox"
                      checked={!!allPageSelected}
                      onChange={() => onToggleSelectAllPage?.()}
                      aria-label="Vybrat vše na stránce"
                    />
                  </th>
                )}
                {visibleColumns.map((col) => (
                  <SortableHeaderCell
                    key={col.id}
                    column={col}
                    effectiveWidth={effectiveWidths[col.id] ?? col.defaultWidthPx}
                    sortDir={
                      sortColumn === col.id && (sortDir === "asc" || sortDir === "desc")
                        ? sortDir
                        : null
                    }
                    onCycleSort={onCycleSort}
                    onResizeStart={handleResizeStart}
                    onResetColumnWidth={onResetColumnWidth}
                  />
                ))}
              </tr>
            </thead>
          </SortableContext>
        </DndContext>
        <tbody>
          {loading && products.length === 0 ? (
            <tr>
              <td colSpan={colCount || 1} className="px-4 py-8 text-center text-gray-500">
                Načítání…
              </td>
            </tr>
          ) : !ready ? (
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
              <tr
                key={p.id}
                className={
                  p.item_status === IML_ITEM_STATUS_DATA_CHANGE
                    ? "border-b border-red-100 bg-red-50 hover:bg-red-100/80"
                    : "border-b border-gray-100 hover:bg-gray-50"
                }
              >
                {selectionEnabled && (
                  <td className="px-2 py-3">
                    <input
                      type="checkbox"
                      checked={selectedIds?.has(p.id) ?? false}
                      onChange={() => onToggleSelect?.(p.id)}
                      aria-label={`Vybrat produkt ${p.id}`}
                    />
                  </td>
                )}
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
          {loadingMore && products.length > 0 && (
            <tr>
              <td colSpan={colCount || 1} className="px-4 py-3 text-center text-sm text-gray-500">
                Načítám další produkty…
              </td>
            </tr>
          )}
        </tbody>
      </table>
      {footer}
    </div>
  );
}
