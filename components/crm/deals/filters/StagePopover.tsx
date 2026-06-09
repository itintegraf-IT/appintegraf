"use client";
import * as React from "react";
import type { Route } from "next";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { ChevronDown, Check } from "lucide-react";
import type { crm_deal_stage } from "@prisma/client";
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
import { setFilter } from "@/lib/crm/deal-filters";
import { STAGE_LABELS, STAGE_DOT, ACTIVE_STAGES, TERMINAL_STAGES } from "@/lib/crm/deal-stages";

type Props = {
  selected: crm_deal_stage[];
};

export function StagePopover({ selected }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [open, setOpen] = React.useState(false);

  const label =
    selected.length === 0
      ? "Stage"
      : selected.length === 1 && selected[0] !== undefined
        ? `Stage: ${STAGE_LABELS[selected[0]]}`
        : `Stage (${selected.length})`;

  function toggle(stage: crm_deal_stage) {
    const next = selected.includes(stage)
      ? selected.filter((x) => x !== stage)
      : [...selected, stage];
    const params = setFilter(
      new URLSearchParams(searchParams?.toString() ?? ""),
      { stages: next },
    );
    const qs = params.toString();
    router.replace((qs ? `${pathname}?${qs}` : pathname) as Route);
  }

  return (
    <ResponsivePopover
      title="Vybrat stage"
      open={open}
      onOpenChange={setOpen}
      trigger={
        <Button type="button" variant="outline" size="sm" className="rounded-full" data-testid="stage-popover-trigger">
          {label}
          <ChevronDown className="ml-1 size-3" aria-hidden />
        </Button>
      }
      contentClassName="w-72 p-0"
    >
      <Command>
        <CommandInput placeholder="Hledat stage…" />
        <CommandList>
          <CommandEmpty>Žádná stage nenalezena.</CommandEmpty>
          <CommandGroup>
            {ACTIVE_STAGES.map((s) => (
              <CommandItem key={s} value={STAGE_LABELS[s]} onSelect={() => toggle(s)}>
                <span className={`size-2 rounded-full ${STAGE_DOT[s]}`} aria-hidden />
                <span className="ml-2 flex-1 truncate">{STAGE_LABELS[s]}</span>
                {selected.includes(s) && <Check className="size-4 text-primary" aria-hidden />}
              </CommandItem>
            ))}
          </CommandGroup>
          <CommandSeparator />
          <CommandGroup>
            {TERMINAL_STAGES.map((s) => (
              <CommandItem key={s} value={STAGE_LABELS[s]} onSelect={() => toggle(s)}>
                <span className={`size-2 rounded-full ${STAGE_DOT[s]}`} aria-hidden />
                <span className="ml-2 flex-1 truncate">{STAGE_LABELS[s]}</span>
                {selected.includes(s) && <Check className="size-4 text-primary" aria-hidden />}
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </Command>
    </ResponsivePopover>
  );
}
