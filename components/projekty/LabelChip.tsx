import { cn } from "@/lib/projekty/utils";

/**
 * Chip štítku. Barva přichází runtime z DB (Label.color, hex) → inline style;
 * 15% podklad přes color-mix + plná barva textu funguje v light i dark módu
 * (nahrazuje dřívější hacky color+"22" a text-white na plné barvě).
 */
export function LabelChip({
  name,
  color,
  className,
}: {
  name: string;
  color: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center truncate rounded-md px-1.5 py-0.5 text-[10px] font-medium",
        className,
      )}
      style={{
        backgroundColor: `color-mix(in srgb, ${color} 15%, transparent)`,
        color,
      }}
      title={name}
    >
      {name}
    </span>
  );
}
