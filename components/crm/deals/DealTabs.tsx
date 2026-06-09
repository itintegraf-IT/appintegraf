"use client";

import type { Route } from "next";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { type ReactNode } from "react";
import { cn } from "@/lib/utils";

const TABS = [
  { id: "timeline", label: "Časová osa" },
  { id: "reminders", label: "Připomenutí" },
  { id: "relations", label: "Navázané záznamy" },
  { id: "notes", label: "Poznámky" },
  { id: "attachments", label: "Přílohy" },
] as const;

type TabId = (typeof TABS)[number]["id"];

type Props = {
  timeline: ReactNode;
  reminders: ReactNode;
  remindersBadge?: number;
  relations: ReactNode;
  notes: ReactNode;
  attachments: ReactNode;
};

export function DealTabs({ timeline, reminders, remindersBadge, relations, notes, attachments }: Props) {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const active = params.get("tab") as TabId | null;
  const isValid = active !== null && TABS.some((t) => t.id === active);
  const current: TabId = isValid && active ? active : "timeline";

  function setTab(id: TabId) {
    const next = new URLSearchParams(params.toString());
    if (id === "timeline") next.delete("tab");
    else next.set("tab", id);
    const qs = next.toString();
    const url = (qs ? `${pathname}?${qs}` : pathname) as Route;
    router.replace(url, { scroll: false });
  }

  const content =
    current === "timeline" ? timeline :
    current === "reminders" ? reminders :
    current === "relations" ? relations :
    current === "notes" ? notes :
    attachments;

  return (
    <div className="space-y-6">
      <div className="sticky top-0 z-10 -mx-8 border-b border-border/40 bg-background/80 px-8 backdrop-blur">
        <div className="flex items-center gap-6 overflow-x-auto">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={cn(
                "relative flex shrink-0 items-center gap-1.5 py-3 text-sm font-medium transition-colors",
                current === t.id ? "text-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {t.label}
              {t.id === "reminders" && remindersBadge !== undefined && remindersBadge > 0 ? (
                <span
                  className={cn(
                    "inline-flex min-w-[18px] items-center justify-center rounded-full px-1 text-[10px] font-semibold leading-none",
                    current === t.id
                      ? "bg-amber-500 text-white"
                      : "bg-amber-100 text-amber-700",
                  )}
                >
                  {remindersBadge}
                </span>
              ) : null}
              {current === t.id ? (
                <span className="absolute inset-x-0 -bottom-px h-0.5 bg-sky-500" />
              ) : null}
            </button>
          ))}
        </div>
      </div>
      <div>{content}</div>
    </div>
  );
}
