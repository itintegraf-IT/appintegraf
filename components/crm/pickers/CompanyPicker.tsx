"use client";

import { useEffect, useState } from "react";
import { Check, ChevronsUpDown, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

type CompanyOption = { id: string; name: string; ico?: string | null };

export function CompanyPicker({
  value,
  onChange,
  placeholder = "Vyber firmu…",
  disabled,
}: {
  value: string | null;
  onChange: (id: string | null, name?: string) => void;
  placeholder?: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [options, setOptions] = useState<CompanyOption[]>([]);
  const [selected, setSelected] = useState<CompanyOption | null>(null);

  useEffect(() => {
    if (!value) {
      setSelected(null);
      return;
    }
    if (selected?.id === value) return;
    fetch(`/api/companies?take=100`)
      .then((r) => r.json())
      .then((j: unknown) => {
        const data = j as { items: CompanyOption[] };
        const hit = data.items.find((c) => c.id === value);
        if (hit) setSelected(hit);
      })
      .catch(() => undefined);
  }, [value, selected?.id]);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => {
      fetch(`/api/companies?take=20&q=${encodeURIComponent(query)}`)
        .then((r) => r.json())
        .then((j: unknown) => {
          const data = j as { items: CompanyOption[] };
          setOptions(data.items);
        })
        .catch(() => undefined);
    }, 200);
    return () => clearTimeout(t);
  }, [query, open]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className="w-full justify-between font-normal"
        >
          <span className="flex min-w-0 items-center gap-2">
            <Building2 className="size-4 shrink-0 text-muted-foreground" strokeWidth={1.75} />
            <span className="truncate">
              {selected ? selected.name : <span className="text-muted-foreground">{placeholder}</span>}
            </span>
          </span>
          <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput placeholder="Hledat firmu…" value={query} onValueChange={setQuery} />
          <CommandList>
            <CommandEmpty>Žádná firma nenalezena.</CommandEmpty>
            <CommandGroup>
              {options.map((o) => (
                <CommandItem
                  key={o.id}
                  value={`${o.name} ${o.ico ?? ""}`}
                  onSelect={() => {
                    const next = o.id === value ? null : o.id;
                    onChange(next, next ? o.name : undefined);
                    setSelected(next ? o : null);
                    setOpen(false);
                  }}
                >
                  <Check className={`mr-2 size-4 ${o.id === value ? "opacity-100" : "opacity-0"}`} />
                  <span className="flex-1 truncate">{o.name}</span>
                  {o.ico ? <span className="text-xs text-muted-foreground">{o.ico}</span> : null}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
