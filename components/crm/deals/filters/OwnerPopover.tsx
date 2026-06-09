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
} from "@/components/ui/command";
import { ResponsivePopover } from "@/components/ui/responsive-popover";
import { UserAvatar } from "@/components/crm/UserAvatar";
import { setFilter } from "@/lib/crm/deal-filters";

type User = { id: number; name: string | null; email: string | null; image: string | null };

type Props = {
  users: User[];
  selected: string[];
  muted: boolean; // true = mine je aktivní (utlumený styl)
};

export function OwnerPopover({ users, selected, muted }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [open, setOpen] = React.useState(false);

  const label =
    selected.length === 0
      ? "Vlastník"
      : selected.length === 1 && selected[0] !== undefined
        ? labelFor(users, selected[0])
        : `Vlastník (${selected.length})`;

  function toggle(id: string) {
    const next = selected.includes(id)
      ? selected.filter((x) => x !== id)
      : [...selected, id];
    const params = setFilter(
      new URLSearchParams(searchParams?.toString() ?? ""),
      { owner_ids: next },
    );
    const qs = params.toString();
    router.replace((qs ? `${pathname}?${qs}` : pathname) as Route);
  }

  return (
    <ResponsivePopover
      title="Vybrat vlastníka"
      open={open}
      onOpenChange={setOpen}
      trigger={
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={`rounded-full ${muted && selected.length === 0 ? "text-muted-foreground" : ""}`}
          title={
            muted && selected.length === 0
              ? "Vypnout Moje OP a filtrovat podle vlastníka"
              : undefined
          }
        >
          {label}
          <ChevronDown className="ml-1 size-3" aria-hidden />
        </Button>
      }
      contentClassName="w-72 p-0"
    >
      <Command>
        <CommandInput placeholder="Hledat obchodníka…" />
        <CommandList>
          <CommandEmpty>Žádný obchodník nenalezen.</CommandEmpty>
          <CommandGroup>
            {users.map((u) => {
              const id = String(u.id);
              const isSelected = selected.includes(id);
              return (
                <CommandItem
                  key={u.id}
                  value={u.name ?? u.email ?? id}
                  onSelect={() => toggle(id)}
                >
                  <UserAvatar user={u} size="xs" />
                  <span className="ml-2 flex-1 truncate">
                    {u.name ?? u.email ?? "(bez jména)"}
                  </span>
                  {isSelected && (
                    <Check className="size-4 text-primary" aria-hidden />
                  )}
                </CommandItem>
              );
            })}
          </CommandGroup>
        </CommandList>
      </Command>
    </ResponsivePopover>
  );
}

function labelFor(users: User[], id: string): string {
  const u = users.find((x) => String(x.id) === id);
  return u?.name ?? u?.email ?? "Vlastník";
}
