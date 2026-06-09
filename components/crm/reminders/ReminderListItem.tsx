"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import Link from "next/link";
import type { Route } from "next";
import { format } from "date-fns";
import { cs } from "date-fns/locale";
import { MoreHorizontal, Trash2, Pencil } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { REMINDER_DOT_COLOR, REMINDER_TYPE_LABEL, isOverdue, type ReminderType } from "@/lib/crm/reminder";

export type ReminderItem = {
  id: string;
  type: ReminderType;
  date: Date | string;
  note: string | null;
  completed_at: Date | string | null;
  parent: { type: "COMPANY" | "DEAL" | "CONTACT"; id: string; name: string };
};

type Props = {
  reminder: ReminderItem;
};

export function ReminderListItem({ reminder }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const overdue = isOverdue(reminder);

  async function toggleDone(checked: boolean) {
    setBusy(true);
    try {
      const res = await fetch(`/api/activities/${reminder.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ completed_at: checked ? new Date().toISOString() : null }),
      });
      if (!res.ok) {
        toast.error("Nepodařilo se uložit změnu.");
        return;
      }
      toast.success(checked ? "Připomenutí splněno" : "Označeno jako nedokončené");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    try {
      const res = await fetch(`/api/activities/${reminder.id}`, { method: "DELETE" });
      if (!res.ok) {
        toast.error("Nepodařilo se smazat.");
        return;
      }
      toast.success("Smazáno");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  const parentHref = (
    reminder.parent.type === "DEAL"
      ? `/deals/${reminder.parent.id}`
      : reminder.parent.type === "COMPANY"
        ? `/companies/${reminder.parent.id}`
        : `/contacts/${reminder.parent.id}`
  ) as Route;

  const completed = reminder.completed_at !== null;

  return (
    <li className="flex items-start gap-2 rounded-lg border border-border/40 bg-card px-2 py-2 text-sm transition-colors hover:border-border/80">
      <label
        className={cn(
          "group/check -ml-0.5 mt-0 flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-full transition-all",
          "hover:bg-emerald-100/70 active:scale-90",
          busy && "cursor-wait opacity-50",
        )}
        title={completed ? "Označit jako nesplněné" : "Označit jako splněné"}
      >
        <Checkbox
          checked={completed}
          onCheckedChange={(v) => toggleDone(Boolean(v))}
          disabled={busy}
          className={cn(
            "size-5 rounded-full border-2 transition-transform group-active/check:scale-90",
            "data-[state=unchecked]:border-muted-foreground/40 group-hover/check:data-[state=unchecked]:border-emerald-500",
            "data-[state=checked]:border-emerald-500 data-[state=checked]:bg-emerald-500 data-[state=checked]:text-white",
          )}
        />
      </label>
      <span className={cn("mt-2.5 size-2 shrink-0 rounded-full", REMINDER_DOT_COLOR[reminder.type])} aria-hidden />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <Link
            href={parentHref}
            className={cn(
              "font-medium hover:underline truncate",
              completed && "line-through opacity-60",
            )}
          >
            {reminder.parent.name}
          </Link>
          <span className="text-xs text-muted-foreground">
            {REMINDER_TYPE_LABEL[reminder.type]} ·{" "}
            <time>{format(new Date(reminder.date), "d. M. yyyy", { locale: cs })}</time>
            {completed && reminder.completed_at ? (
              <span className="ml-1 rounded bg-emerald-100 px-1.5 text-emerald-700">
                ✓ Hotovo {format(new Date(reminder.completed_at), "d. M.", { locale: cs })}
              </span>
            ) : overdue ? (
              <span className="ml-1 rounded bg-rose-100 px-1.5 text-rose-700">overdue</span>
            ) : null}
          </span>
        </div>
        {reminder.note ? (
          <p
            className={cn(
              "mt-1 whitespace-pre-wrap break-words text-sm text-muted-foreground",
              completed && "line-through opacity-60",
            )}
          >
            {reminder.note}
          </p>
        ) : null}
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger className="rounded-md p-1 text-muted-foreground hover:bg-muted" aria-label="Akce">
          <MoreHorizontal className="size-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem asChild>
            <Link href={parentHref}>
              <Pencil className="mr-2 size-4" /> Otevřít detail
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={remove}
            className="text-destructive focus:bg-destructive/10 focus:text-destructive"
          >
            <Trash2 className="mr-2 size-4" /> Smazat
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </li>
  );
}
