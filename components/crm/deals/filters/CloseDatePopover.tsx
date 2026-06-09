"use client";
import * as React from "react";
import type { Route } from "next";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ResponsivePopover } from "@/components/ui/responsive-popover";
import { setFilter } from "@/lib/crm/deal-filters";

type Props = {
  closeFrom: Date | null;
  closeTo: Date | null;
};

function fmt(d: Date | null): string {
  if (!d) return "";
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function toDate(value: string): Date | null {
  if (!value) return null;
  const [y, m, d] = value.split("-").map(Number);
  if (!y || !m || !d) return null;
  const date = new Date(y, m - 1, d);
  return Number.isNaN(date.getTime()) ? null : date;
}

function quarterRange(quarter: number, year: number): { from: Date; to: Date } {
  const startMonth = (quarter - 1) * 3;
  // Local midnight: výsledná YYYY-MM-DD odpovídá tomu, co uživatel vidí v prohlížeči.
  const from = new Date(year, startMonth, 1);
  const to = new Date(year, startMonth + 3, 0);
  return { from, to };
}

export function CloseDatePopover({ closeFrom, closeTo }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [open, setOpen] = React.useState(false);

  const label =
    closeFrom && closeTo ? `${fmt(closeFrom)} → ${fmt(closeTo)}` :
    closeFrom ? `od ${fmt(closeFrom)}` :
    closeTo ? `do ${fmt(closeTo)}` :
    "Uzavření";

  function apply(from: Date | null, to: Date | null) {
    const params = setFilter(new URLSearchParams(searchParams?.toString() ?? ""), {
      closeFrom: from,
      closeTo: to,
    });
    const qs = params.toString();
    router.replace((qs ? `${pathname}?${qs}` : pathname) as Route);
  }

  function next30Days() {
    const today = new Date();
    const localMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const to = new Date(localMidnight);
    to.setDate(to.getDate() + 30);
    apply(localMidnight, to);
    setOpen(false);
  }

  function thisQuarter() {
    const now = new Date();
    const q = Math.floor(now.getMonth() / 3) + 1;
    const { from, to } = quarterRange(q, now.getFullYear());
    apply(from, to);
    setOpen(false);
  }

  function nextQuarter() {
    const now = new Date();
    const q = Math.floor(now.getMonth() / 3) + 1;
    const nextQ = q === 4 ? 1 : q + 1;
    const year = q === 4 ? now.getFullYear() + 1 : now.getFullYear();
    const { from, to } = quarterRange(nextQ, year);
    apply(from, to);
    setOpen(false);
  }

  return (
    <ResponsivePopover
      title="Odhad uzavření"
      open={open}
      onOpenChange={setOpen}
      trigger={
        <Button type="button" variant="outline" size="sm" className="rounded-full">
          {label}
          <ChevronDown className="ml-1 size-3" aria-hidden />
        </Button>
      }
      contentClassName="w-80"
    >
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <Button type="button" variant="outline" size="sm" onClick={thisQuarter}>Aktuální Q</Button>
          <Button type="button" variant="outline" size="sm" onClick={nextQuarter}>Příští Q</Button>
          <Button type="button" variant="outline" size="sm" onClick={next30Days}>Příštích 30 dní</Button>
          <Button type="button" variant="ghost" size="sm" onClick={() => { apply(null, null); setOpen(false); }}>
            Vyčistit
          </Button>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <label className="space-y-1 text-xs">
            <span className="text-muted-foreground">Od</span>
            <Input
              type="date"
              value={fmt(closeFrom)}
              onChange={(e) => apply(toDate(e.target.value), closeTo)}
            />
          </label>
          <label className="space-y-1 text-xs">
            <span className="text-muted-foreground">Do</span>
            <Input
              type="date"
              value={fmt(closeTo)}
              onChange={(e) => apply(closeFrom, toDate(e.target.value))}
            />
          </label>
        </div>
      </div>
    </ResponsivePopover>
  );
}
