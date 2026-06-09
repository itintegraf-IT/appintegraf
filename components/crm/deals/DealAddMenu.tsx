"use client";

import { useState } from "react";
import { Plus, BellRing, Coffee, Phone, Mail } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ActivityForm } from "@/components/crm/activities/ActivityForm";
import type { crm_activity_type } from "@prisma/client";

type Props = {
  dealId: string;
  users: { id: number; name: string | null; email: string | null }[];
};

const ITEMS: { type: crm_activity_type; label: string; Icon: typeof BellRing }[] = [
  { type: "REMINDER", label: "Připomenutí", Icon: BellRing },
  { type: "MEETING", label: "Schůzka", Icon: Coffee },
  { type: "CALL", label: "Hovor", Icon: Phone },
  { type: "EMAIL", label: "E-mail", Icon: Mail },
];

const TITLE_BY_TYPE: Record<crm_activity_type, string> = {
  REMINDER: "Nové připomenutí",
  MEETING: "Nová schůzka",
  CALL: "Nový hovor",
  EMAIL: "Nový e-mail",
  NOTE: "Nová poznámka",
};

export function DealAddMenu({ dealId, users }: Props) {
  const [open, setOpen] = useState<crm_activity_type | null>(null);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label="Přidat aktivitu"
            className="inline-flex size-11 items-center justify-center rounded-full bg-emerald-500 text-white shadow-sm transition hover:bg-emerald-600 active:scale-95"
          >
            <Plus className="size-5" strokeWidth={2.5} />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48 rounded-2xl p-2">
          {ITEMS.map(({ type, label, Icon }) => (
            <DropdownMenuItem
              key={type}
              onSelect={() => setOpen(type)}
              className="flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2 text-sm"
            >
              <Icon className="size-4 text-muted-foreground" strokeWidth={1.75} />
              <span>{label}</span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={open !== null} onOpenChange={(v) => !v && setOpen(null)}>
        <DialogContent className="max-w-xl rounded-3xl">
          <DialogHeader>
            <DialogTitle>{open ? TITLE_BY_TYPE[open] : ""}</DialogTitle>
          </DialogHeader>
          {open ? (
            <ActivityForm
              mode={{ kind: "create", parent_type: "DEAL", parent_id: dealId }}
              users={users}
              onSuccess={() => setOpen(null)}
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
