import { clampColumnWidth, type ProductListColumnId } from "./product-list-columns";

export type StartColumnResizeOptions = {
  columnId: ProductListColumnId;
  startX: number;
  startWidth: number;
  onResize: (width: number) => void;
  onEnd: (width: number) => void;
};

export function startColumnResize({
  columnId,
  startX,
  startWidth,
  onResize,
  onEnd,
}: StartColumnResizeOptions): void {
  const prevCursor = document.body.style.cursor;
  const prevUserSelect = document.body.style.userSelect;
  document.body.style.cursor = "col-resize";
  document.body.style.userSelect = "none";

  let lastWidth = startWidth;

  const onMove = (e: MouseEvent) => {
    const next = clampColumnWidth(columnId, startWidth + (e.clientX - startX));
    lastWidth = next;
    onResize(next);
  };

  const onUp = () => {
    document.removeEventListener("mousemove", onMove);
    document.removeEventListener("mouseup", onUp);
    document.body.style.cursor = prevCursor;
    document.body.style.userSelect = prevUserSelect;
    onEnd(lastWidth);
  };

  document.addEventListener("mousemove", onMove);
  document.addEventListener("mouseup", onUp);
}
