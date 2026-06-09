"use client";

import { useEffect, useState } from "react";
import { Check, ChevronsUpDown, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

type ContactOption = { id: string; first_name: string; last_name: string; email: string | null };

export function ContactPicker({
  company_id,
  value,
  onChange,
}: {
  company_id: string | null;
  value: string[];
  onChange: (ids: string[]) => void;
}) {
  const [options, setOptions] = useState<ContactOption[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!company_id) {
      setOptions([]);
      return;
    }
    fetch(`/api/contacts?company_id=${company_id}&take=100`)
      .then((r) => r.json())
      .then((j: unknown) => {
        const data = j as { items: ContactOption[] };
        setOptions(data.items);
      })
      .catch(() => undefined);
  }, [company_id]);

  function toggle(id: string) {
    if (value.includes(id)) onChange(value.filter((x) => x !== id));
    else onChange([...value, id]);
  }

  if (!company_id) {
    return <p className="text-sm text-muted-foreground">Nejdřív vyber firmu.</p>;
  }
  if (options.length === 0) {
    return <p className="text-sm text-muted-foreground">Tato firma nemá kontakty.</p>;
  }

  const selected = options.filter((o) => value.includes(o.id));

  return (
    <div className="space-y-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between font-normal"
          >
            <span className="flex min-w-0 items-center gap-2">
              <User className="size-4 shrink-0 text-muted-foreground" strokeWidth={1.75} />
              <span className="truncate">
                {selected.length > 0 ? (
                  `${selected.length} vybraných`
                ) : (
                  <span className="text-muted-foreground">Vyber kontakty…</span>
                )}
              </span>
            </span>
            <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
          <Command>
            <CommandInput placeholder="Hledat kontakt…" />
            <CommandList>
              <CommandEmpty>Žádný kontakt nenalezen.</CommandEmpty>
              <CommandGroup>
                {options.map((o) => {
                  const isSelected = value.includes(o.id);
                  return (
                    <CommandItem
                      key={o.id}
                      value={`${o.first_name} ${o.last_name} ${o.email ?? ""}`}
                      onSelect={() => toggle(o.id)}
                    >
                      <Check className={`mr-2 size-4 ${isSelected ? "opacity-100" : "opacity-0"}`} />
                      <span className="flex-1 truncate">
                        {o.first_name} {o.last_name}
                      </span>
                      {o.email ? <span className="text-xs text-muted-foreground">{o.email}</span> : null}
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {selected.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {selected.map((o) => (
            <Badge key={o.id} variant="secondary" className="gap-1">
              {o.first_name} {o.last_name}
              <button
                type="button"
                onClick={() => toggle(o.id)}
                className="ml-0.5 text-muted-foreground hover:text-foreground"
                aria-label={`Odebrat ${o.first_name} ${o.last_name}`}
              >
                ×
              </button>
            </Badge>
          ))}
        </div>
      ) : null}
    </div>
  );
}
