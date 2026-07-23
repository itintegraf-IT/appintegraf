"use client";

import { Users } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/projekty/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/projekty/ui/popover";
import { Checkbox } from "@/components/projekty/ui/checkbox";
import { UserAvatar } from "@/components/projekty/UserAvatar";
import { useBulkSelection } from "./BulkSelectionContext";

type MemberLite = { id: number; name: string | null; email: string | null; image: string | null };

export function BulkMembersPicker({
  members,
  onApplied,
}: {
  members: MemberLite[];
  onApplied: () => void;
}) {
  const sel = useBulkSelection();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [checked, setChecked] = useState<Set<string>>(new Set());

  function toggle(id: string) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function apply() {
    if (checked.size === 0) return;
    setBusy(true);
    try {
      const res = await fetch("/api/projekty/cards/bulk", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "addMember",
          cardIds: [...sel.selectedIds],
          payload: { userIds: [...checked] },
        }),
      });
      if (!res.ok) throw new Error("API error");
      toast.success(`Členové přidáni k ${sel.count} kartám`);
      sel.clear();
      onApplied();
      setOpen(false);
      setChecked(new Set());
    } catch {
      toast.error("Přiřazení členů selhalo");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" disabled={busy}>
          <Users className="mr-1 size-3.5" />
          Členy
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 p-2">
        <div className="px-1 pb-1 text-xs font-medium uppercase text-muted-foreground">
          Přidat členy
        </div>
        <div className="max-h-60 overflow-y-auto">
          {members.map((m) => (
            <label
              key={m.id}
              className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 hover:bg-accent"
            >
              <Checkbox checked={checked.has(String(m.id))} onCheckedChange={() => toggle(String(m.id))} />
              <UserAvatar user={m} size="xs" />
              <span className="text-sm">{m.name ?? m.email ?? "(bez jména)"}</span>
            </label>
          ))}
        </div>
        <div className="pt-2">
          <Button size="sm" onClick={() => void apply()} disabled={busy || checked.size === 0}>
            Použít
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
