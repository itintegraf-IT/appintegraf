"use client";

import { useIsMac } from "@/hooks/projekty/useIsMac";
import { formatShortcut } from "@/lib/projekty/platform";
import { cn } from "@/lib/projekty/utils";

/**
 * Platform-aware zobrazení klávesové zkratky: <Kbd shortcut="mod+K" />
 * renderuje „Ctrl+K" (default/Windows) nebo „⌘K" (mac po detekci).
 */
export function Kbd({
  shortcut,
  className,
}: {
  shortcut: string;
  className?: string;
}) {
  const isMac = useIsMac();
  return (
    <kbd
      className={cn(
        "rounded border border-border bg-background px-1.5 py-0.5 text-[11px] font-medium",
        className,
      )}
    >
      {formatShortcut(shortcut, isMac)}
    </kbd>
  );
}
