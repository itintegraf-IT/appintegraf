"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Input } from "@/components/projekty/ui/input";
import { Button } from "@/components/projekty/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/projekty/ui/popover";
import { Search, Users, Tag, Calendar, X, CheckCircle2 } from "lucide-react";
import { UserAvatar } from "@/components/projekty/UserAvatar";
import { type CardFilters, parseCardFilters, serializeCardFilters } from "@/lib/projekty/card-filters";

type UserLite = { id: number; email: string | null; name: string | null; image: string | null };
type Label = { id: string; name: string; color: string };

export function BoardCardFilterBar({
  members,
  labels,
}: {
  members: UserLite[];
  labels: Label[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const filters = parseCardFilters(searchParams);

  function update(patch: Partial<CardFilters>) {
    const next = { ...filters, ...patch };
    const sp = new URLSearchParams(searchParams.toString());
    for (const k of ["q", "members", "labels", "due", "completed"]) sp.delete(k);
    for (const [k, v] of serializeCardFilters(next).entries()) sp.set(k, v);
    router.replace(`${pathname}${sp.toString() ? `?${sp.toString()}` : ""}`);
  }

  function toggleMember(id: string) {
    const ids = new Set(filters.memberIds ?? []);
    if (ids.has(id)) ids.delete(id);
    else ids.add(id);
    update({ memberIds: ids.size > 0 ? Array.from(ids) : undefined });
  }

  function toggleLabel(id: string) {
    const ids = new Set(filters.labelIds ?? []);
    if (ids.has(id)) ids.delete(id);
    else ids.add(id);
    update({ labelIds: ids.size > 0 ? Array.from(ids) : undefined });
  }

  const hasFilters =
    Boolean(filters.q) ||
    Boolean(filters.memberIds?.length) ||
    Boolean(filters.labelIds?.length) ||
    Boolean(filters.dueRange) ||
    filters.completed === "false" ||
    filters.completed === "true";

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-[hsl(var(--notion-fg)/0.09)] bg-[hsl(var(--notion-canvas))] px-3 py-2">
      <div className="relative">
        <Search className="absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-[hsl(var(--notion-fg)/0.4)]" />
        <Input
          value={filters.q ?? ""}
          onChange={(e) => update({ q: e.target.value || undefined })}
          placeholder="Hledat…"
          className="h-8 w-32 bg-[hsl(var(--notion-surface))] pl-7 text-[hsl(var(--notion-fg))] placeholder:text-[hsl(var(--notion-fg)/0.4)] sm:w-48"
        />
      </div>

      <Popover>
        <PopoverTrigger asChild>
          <Button size="sm" variant="outline">
            <Users className="mr-1 size-3.5" />
            <span className="hidden sm:inline">Členové</span>
            {filters.memberIds?.length ? (
              <span className="ml-0.5 sm:ml-0">({filters.memberIds.length})</span>
            ) : null}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-56 p-2" align="start">
          {members.length === 0 ? (
            <p className="px-2 py-1 text-sm text-muted-foreground">Žádní členové.</p>
          ) : (
            members.map((u) => (
              <button
                key={u.id}
                onClick={() => toggleMember(String(u.id))}
                className={`flex w-full items-center gap-2 rounded px-2 py-1 text-left text-sm hover:bg-muted/60 ${
                  filters.memberIds?.includes(String(u.id)) ? "bg-muted" : ""
                }`}
              >
                <UserAvatar user={u} className="size-5" />
                <span className="flex-1">{u.name ?? u.email ?? "—"}</span>
              </button>
            ))
          )}
        </PopoverContent>
      </Popover>

      <Popover>
        <PopoverTrigger asChild>
          <Button size="sm" variant="outline">
            <Tag className="mr-1 size-3.5" />
            <span className="hidden sm:inline">Labely</span>
            {filters.labelIds?.length ? (
              <span className="ml-0.5 sm:ml-0">({filters.labelIds.length})</span>
            ) : null}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-56 p-2" align="start">
          {labels.length === 0 ? (
            <p className="px-2 py-1 text-sm text-muted-foreground">Žádné labely.</p>
          ) : (
            labels.map((l) => (
              <button
                key={l.id}
                onClick={() => toggleLabel(l.id)}
                className={`flex w-full items-center gap-2 rounded px-2 py-1 text-left text-sm hover:bg-muted/60 ${
                  filters.labelIds?.includes(l.id) ? "bg-muted" : ""
                }`}
              >
                <span
                  className="size-3 rounded"
                  style={{ backgroundColor: l.color }}
                />
                <span className="flex-1">{l.name}</span>
              </button>
            ))
          )}
        </PopoverContent>
      </Popover>

      <Popover>
        <PopoverTrigger asChild>
          <Button size="sm" variant="outline">
            <Calendar className="mr-1 size-3.5" />
            <span className="hidden sm:inline">Termín</span>
            {filters.dueRange ? (
              <span className="ml-0.5 sm:ml-0">
                <span className="hidden sm:inline"> · </span>
                {filters.dueRange === "overdue"
                  ? "po termínu"
                  : filters.dueRange === "today"
                    ? "dnes"
                    : filters.dueRange === "week"
                      ? "tento týden"
                      : "bez termínu"}
              </span>
            ) : null}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-44 p-1" align="start">
          {(["overdue", "today", "week", "none"] as const).map((r) => (
            <button
              key={r}
              onClick={() =>
                update({ dueRange: filters.dueRange === r ? undefined : r })
              }
              className={`block w-full rounded px-2 py-1 text-left text-sm hover:bg-muted/60 ${
                filters.dueRange === r ? "bg-muted" : ""
              }`}
            >
              {r === "overdue"
                ? "Po termínu"
                : r === "today"
                  ? "Dnes"
                  : r === "week"
                    ? "Tento týden"
                    : "Bez termínu"}
            </button>
          ))}
        </PopoverContent>
      </Popover>

      <Button
        size="sm"
        variant={filters.completed === "false" ? "default" : "outline"}
        onClick={() =>
          update({ completed: filters.completed === "false" ? "any" : "false" })
        }
        aria-label="Skrýt dokončené"
      >
        <CheckCircle2 className="size-3.5 sm:mr-1" />
        <span className="hidden sm:inline">Skrýt dokončené</span>
      </Button>

      {hasFilters ? (
        <Button
          size="sm"
          variant="ghost"
          aria-label="Vymazat filtry"
          onClick={() =>
            update({
              q: undefined,
              memberIds: undefined,
              labelIds: undefined,
              dueRange: undefined,
              completed: "any",
            })
          }
        >
          <X className="size-3.5 sm:mr-1" />
          <span className="hidden sm:inline">Vymazat</span>
        </Button>
      ) : null}
    </div>
  );
}
