"use client";

type Orientation = "horizontal" | "vertical";

const NOTION_BLUE = "hsl(199 75% 52%)";

/**
 * Drop indicator pro drag-and-drop. Renderovat conditionally v cílové pozici
 * mezi karty (horizontal) nebo mezi sloupce (vertical).
 *
 * Vykresluje 4 px modrou rounded čáru s negative margin tak, aby se
 * "vsedla" do existujícího gap mezi sourozenci a nezvětšila layout.
 */
export function DropLine({ orientation }: { orientation: Orientation }) {
  if (orientation === "horizontal") {
    return (
      <div
        aria-hidden
        className="-my-0.5 h-1 rounded-full"
        style={{ backgroundColor: NOTION_BLUE }}
      />
    );
  }
  return (
    <div
      aria-hidden
      className="-mx-0.5 w-1 self-stretch rounded-full"
      style={{ backgroundColor: NOTION_BLUE }}
    />
  );
}
