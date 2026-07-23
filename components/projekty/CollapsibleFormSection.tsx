"use client";

import { useState, type ReactNode } from "react";
import { Button } from "@/components/projekty/ui/button";
import { ChevronDown, Plus } from "lucide-react";

type CollapsibleFormSectionProps = {
  label: string;
  children: ReactNode;
  defaultOpen?: boolean;
};

export function CollapsibleFormSection({ label, children, defaultOpen = false }: CollapsibleFormSectionProps) {
  const [open, setOpen] = useState(defaultOpen);

  if (!open) {
    return (
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Plus className="mr-1 size-4" strokeWidth={1.75} />
        {label}
      </Button>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-sm font-medium text-foreground">{label}</span>
        <Button variant="ghost" size="sm" onClick={() => setOpen(false)} aria-label="Zavřít formulář">
          <ChevronDown className="size-4" strokeWidth={1.75} />
        </Button>
      </div>
      {children}
    </div>
  );
}
