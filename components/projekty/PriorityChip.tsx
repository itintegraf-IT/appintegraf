import { cn } from "@/lib/projekty/utils";
import {
  PRIORITY_CHIP_CLASSES,
  PRIORITY_DOT_CLASSES,
  PRIORITY_LABELS,
  type CardPriorityValue,
} from "@/lib/projekty/priority";

/**
 * Jednotný chip priority karty. `dot` je kompaktní varianta pro kanban kartu,
 * kde je meta řádek nejtěsnější — barva nese informaci, název jde do title.
 * Bez priority se nekreslí nic (null = výchozí stav, ne nejnižší stupeň).
 */
export function PriorityChip({
  priority,
  variant = "chip",
  className,
}: {
  priority: CardPriorityValue | null | undefined;
  variant?: "chip" | "dot";
  className?: string;
}) {
  if (!priority) return null;
  const label = PRIORITY_LABELS[priority];

  if (variant === "dot") {
    return (
      <span
        className={cn("inline-flex shrink-0 items-center", className)}
        title={`Priorita: ${label}`}
      >
        <span
          className={cn("size-2 rounded-full", PRIORITY_DOT_CLASSES[priority])}
          aria-hidden
        />
        <span className="sr-only">{`Priorita: ${label}`}</span>
      </span>
    );
  }

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium",
        PRIORITY_CHIP_CLASSES[priority],
        className,
      )}
      title={`Priorita: ${label}`}
    >
      <span
        className={cn("size-1.5 rounded-full", PRIORITY_DOT_CLASSES[priority])}
        aria-hidden
      />
      {label}
    </span>
  );
}
