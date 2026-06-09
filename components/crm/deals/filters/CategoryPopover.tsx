"use client";
import * as React from "react";
import type { Route } from "next";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { ChevronDown, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { ResponsivePopover } from "@/components/ui/responsive-popover";
import { setFilter, NO_CATEGORY_SENTINEL } from "@/lib/crm/deal-filters";

type Cat = { id: string; code: string; label: string; color: string | null };

export function CategoryPopover({
  categories,
  selected,
}: {
  categories: Cat[];
  selected: string[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [open, setOpen] = React.useState(false);

  const label =
    selected.length === 0
      ? "Kategorie"
      : selected.length === 1 && selected[0] !== undefined
        ? labelFor(categories, selected[0])
        : `Kategorie (${selected.length})`;

  function toggle(id: string) {
    const next = selected.includes(id)
      ? selected.filter((x) => x !== id)
      : [...selected, id];
    const params = setFilter(
      new URLSearchParams(searchParams?.toString() ?? ""),
      { category_ids: next },
    );
    const qs = params.toString();
    router.replace((qs ? `${pathname}?${qs}` : pathname) as Route);
  }

  return (
    <ResponsivePopover
      title="Vybrat kategorie"
      open={open}
      onOpenChange={setOpen}
      trigger={
        <Button type="button" variant="outline" size="sm" className="rounded-full">
          {label}
          <ChevronDown className="ml-1 size-3" aria-hidden />
        </Button>
      }
      contentClassName="w-72 p-0"
    >
      <Command>
        <CommandInput placeholder="Hledat kategorii…" />
        <CommandList>
          <CommandEmpty>Žádná kategorie nenalezena.</CommandEmpty>
          <CommandGroup>
            {categories.map((c) => {
              const isSelected = selected.includes(c.id);
              return (
                <CommandItem key={c.id} value={c.label} onSelect={() => toggle(c.id)}>
                  <span
                    className="size-2 rounded-full"
                    style={{ backgroundColor: c.color ?? "#9ca3af" }}
                    aria-hidden
                  />
                  <span className="ml-2 flex-1 truncate">{c.label}</span>
                  {isSelected && <Check className="size-4 text-primary" aria-hidden />}
                </CommandItem>
              );
            })}
          </CommandGroup>
          <CommandSeparator />
          <CommandGroup>
            <CommandItem
              value="bez kategorie"
              onSelect={() => toggle(NO_CATEGORY_SENTINEL)}
            >
              <span className="size-2 rounded-full bg-muted" aria-hidden />
              <span className="ml-2 flex-1 italic text-muted-foreground">
                (bez kategorie)
              </span>
              {selected.includes(NO_CATEGORY_SENTINEL) && (
                <Check className="size-4 text-primary" aria-hidden />
              )}
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </Command>
    </ResponsivePopover>
  );
}

function labelFor(categories: Cat[], id: string): string {
  if (id === NO_CATEGORY_SENTINEL) return "(bez kategorie)";
  return categories.find((c) => c.id === id)?.label ?? "Kategorie";
}
