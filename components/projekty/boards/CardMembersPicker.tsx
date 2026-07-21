"use client";

import { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/projekty/ui/popover";
import { Button } from "@/components/projekty/ui/button";
import { UserAvatar } from "@/components/projekty/UserAvatar";
import { Users, Check } from "lucide-react";
import { toast } from "sonner";

type UserLite = { id: number; email: string | null; name: string | null; image: string | null };

export function CardMembersPicker({
  cardId,
  assignedUserIds,
  boardMembers,
  onChange,
}: {
  cardId: string;
  assignedUserIds: number[];
  boardMembers: UserLite[];
  onChange: (userIds: number[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<number | null>(null);

  async function toggle(member: UserLite) {
    setBusy(member.id);
    const isAssigned = assignedUserIds.includes(member.id);
    try {
      const res = await fetch(
        `/api/projekty/cards/${cardId}/members${isAssigned ? `/${member.id}` : ""}`,
        {
          method: isAssigned ? "DELETE" : "POST",
          headers: { "content-type": "application/json" },
          body: isAssigned ? null : JSON.stringify({ userId: member.id }),
        },
      );
      if (!res.ok) {
        toast.error("Úprava členů selhala.");
        return;
      }
      onChange(
        isAssigned
          ? assignedUserIds.filter((id) => id !== member.id)
          : [...assignedUserIds, member.id],
      );
    } catch {
      toast.error("Úprava členů selhala (chyba sítě).");
    } finally {
      setBusy(null);
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm">
          <Users className="mr-2 size-4" />
          Členové ({assignedUserIds.length})
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0" align="start">
        <div className="max-h-72 overflow-y-auto p-2">
          {boardMembers.length === 0 ? (
            <p className="p-2 text-sm text-muted-foreground">Žádní členové boardu.</p>
          ) : (
            boardMembers.map((u) => {
              const assigned = assignedUserIds.includes(u.id);
              return (
                <button
                  key={u.id}
                  onClick={() => void toggle(u)}
                  disabled={busy === u.id}
                  className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left hover:bg-muted/60 disabled:opacity-50"
                >
                  <UserAvatar user={u} className="size-6" />
                  <span className="flex-1 text-sm">{u.name ?? u.email ?? "—"}</span>
                  {assigned ? <Check className="size-4 text-primary" /> : null}
                </button>
              );
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
