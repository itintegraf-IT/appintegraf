"use client";

import { cn } from "@/lib/utils";

export type CategoryOption = {
  id: string;
  code: string;
  label: string;
  color: string;
};

export function CategoryPicker({
  categories,
  value,
  onChange,
}: {
  categories: CategoryOption[];
  value: string | null;
  onChange: (id: string | null) => void;
}) {
  if (categories.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Žádné kategorie — přidej je v <a href="/admin/deal-categories" className="underline">adminu</a>.
      </p>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      {categories.map((c) => {
        const active = value === c.id;
        return (
          <button
            key={c.id}
            type="button"
            onClick={() => onChange(active ? null : c.id)}
            aria-pressed={active}
            className={cn(
              "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition-colors",
              active
                ? "border-transparent text-white"
                : "border-border bg-background text-foreground hover:bg-muted",
            )}
            style={active ? { backgroundColor: c.color } : undefined}
          >
            <span
              className="size-2.5 rounded-full"
              style={{ backgroundColor: active ? "white" : c.color }}
            />
            <span>{c.label}</span>
          </button>
        );
      })}
    </div>
  );
}
