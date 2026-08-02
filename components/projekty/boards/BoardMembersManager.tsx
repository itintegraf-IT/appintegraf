"use client";

import { useState, useMemo } from "react";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/projekty/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/projekty/ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/projekty/ui/dropdown-menu";
import { Button } from "@/components/projekty/ui/button";
import { ConfirmDialog } from "@/components/projekty/ui/confirm-dialog";
import { UserAvatar } from "@/components/projekty/UserAvatar";
import { Trash2, Plus, Crown } from "lucide-react";
import { toast } from "sonner";

type UserLite = { id: number; email: string | null; name: string | null; image: string | null };
type BoardRole = "ADMIN" | "MEMBER" | "OBSERVER";
type Member = { boardId: string; userId: number; role: BoardRole; user: UserLite };

const ROLE_LABEL: Record<BoardRole, string> = {
  ADMIN: "Admin",
  MEMBER: "Člen",
  OBSERVER: "Pozorovatel",
};

export function BoardMembersManager({
  boardId,
  members: initialMembers,
  allUsers,
  ownerId,
  currentUserId,
}: {
  boardId: string;
  members: Member[];
  allUsers: UserLite[];
  ownerId: number;
  currentUserId: number;
}) {
  const [members, setMembers] = useState(initialMembers);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const memberIds = useMemo(() => new Set(members.map((m) => m.userId)), [members]);
  const candidates = allUsers.filter((u) => u.id !== ownerId && !memberIds.has(u.id));

  async function handleAdd(userId: number) {
    setBusy(true);
    setOpen(false);
    try {
      const res = await fetch(`/api/projekty/boards/${boardId}/members`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ userId, role: "MEMBER" }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        toast.error(data.error ?? "Přidání selhalo.");
        return;
      }
      const { member } = (await res.json()) as { member: Member };
      setMembers((prev) => [...prev, member]);
    } catch {
      toast.error("Přidání selhalo (chyba sítě).");
    } finally {
      setBusy(false);
    }
  }

  async function handleRoleChange(userId: number, role: BoardRole) {
    setBusy(true);
    try {
      const res = await fetch(`/api/projekty/boards/${boardId}/members/${userId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ role }),
      });
      if (!res.ok) {
        toast.error("Změna role selhala.");
        return;
      }
      setMembers((prev) =>
        prev.map((m) => (m.userId === userId ? { ...m, role } : m)),
      );
    } catch {
      toast.error("Změna role selhala (chyba sítě).");
    } finally {
      setBusy(false);
    }
  }

  async function handleRemove(userId: number) {
    setBusy(true);
    try {
      const res = await fetch(`/api/projekty/boards/${boardId}/members/${userId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        toast.error("Odebrání selhalo.");
        return;
      }
      setMembers((prev) => prev.filter((m) => m.userId !== userId));
    } catch {
      toast.error("Odebrání selhalo (chyba sítě).");
    } finally {
      setBusy(false);
    }
  }

  const owner = allUsers.find((u) => u.id === ownerId);

  return (
    <section className="rounded border p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Členové</h2>
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button size="sm" disabled={busy || candidates.length === 0}>
              <Plus className="mr-1 size-4" />
              Přidat člena
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-72 p-0" align="end">
            <Command>
              <CommandInput placeholder="Hledat uživatele…" />
              <CommandList>
                <CommandEmpty>Žádný uživatel nenalezen.</CommandEmpty>
                <CommandGroup>
                  {candidates.map((u) => (
                    <CommandItem
                      key={u.id}
                      value={`${u.name ?? ""} ${u.email ?? ""}`}
                      onSelect={() => void handleAdd(u.id)}
                    >
                      <UserAvatar user={u} className="mr-2 size-6" />
                      <div className="flex flex-col">
                        <span className="text-sm">{u.name ?? u.email ?? "—"}</span>
                        {u.email && u.name ? <span className="text-xs text-muted-foreground">{u.email}</span> : null}
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </div>

      <ul className="divide-y">
        {owner ? (
          <li className="flex items-center gap-3 py-2">
            <UserAvatar user={owner} className="size-8" />
            <div className="flex-1">
              <div className="text-sm font-medium">{owner.name ?? owner.email ?? "—"}</div>
              {owner.email ? <div className="text-xs text-muted-foreground">{owner.email}</div> : null}
            </div>
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Crown className="size-3" /> Owner
            </span>
          </li>
        ) : null}
        {members.map((m) => {
          const isSelf = m.userId === currentUserId;
          return (
            <li key={m.userId} className="flex items-center gap-3 py-2">
              <UserAvatar user={m.user} className="size-8" />
              <div className="flex-1">
                <div className="text-sm font-medium">{m.user.name ?? m.user.email ?? "—"}</div>
                {m.user.email ? <div className="text-xs text-muted-foreground">{m.user.email}</div> : null}
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="sm" variant="outline" disabled={busy || isSelf}>
                    {ROLE_LABEL[m.role]}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {(["ADMIN", "MEMBER", "OBSERVER"] as const).map((r) => (
                    <DropdownMenuItem key={r} onClick={() => void handleRoleChange(m.userId, r)}>
                      {ROLE_LABEL[r]}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
              <ConfirmDialog
                trigger={
                  <Button
                    size="icon"
                    variant="ghost"
                    disabled={busy || isSelf}
                    aria-label="Odebrat člena"
                  >
                    <Trash2 className="size-4" />
                  </Button>
                }
                title={`Odebrat ${m.user.name ?? m.user.email ?? "člena"} z boardu?`}
                destructive
                confirmLabel="Odebrat"
                onConfirm={() => handleRemove(m.userId)}
              />
            </li>
          );
        })}
      </ul>
    </section>
  );
}
