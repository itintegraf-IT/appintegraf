"use client";

import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";

type Size = "sm" | "lg";

export function QuickAddButton({
  onClick,
  size = "lg",
  disabled,
  label = "Přidat deal",
}: {
  onClick: () => void;
  size?: Size;
  disabled?: boolean;
  label?: string;
}) {
  const dim = size === "lg" ? "size-11" : "size-7";
  const icon = size === "lg" ? "size-5" : "size-4";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={disabled ? "Nemáš oprávnění vytvářet dealy" : label}
      className={cn(
        "inline-flex items-center justify-center rounded-full bg-success text-success-foreground shadow-sm",
        "transition-transform duration-150",
        "hover:scale-105 active:scale-95",
        "disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:scale-100",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        dim,
      )}
    >
      <Plus className={icon} strokeWidth={2.5} />
    </button>
  );
}
