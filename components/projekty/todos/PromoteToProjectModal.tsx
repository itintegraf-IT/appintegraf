"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import type { PersonalTodo } from "@prisma/client";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/projekty/ui/dialog";
import { Button } from "@/components/projekty/ui/button";
import { cn } from "@/lib/projekty/utils";
import type { BoardLite } from "@/components/projekty/todos/types";

const LAST_BOARD_KEY = "personalTodo:lastBoardId";

export function PromoteToProjectModal({
  todo,
  boards,
  open,
  onOpenChange,
}: {
  todo: PersonalTodo | null;
  boards: BoardLite[];
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [selectedBoardId, setSelectedBoardId] = useState<string | null>(null);
  const [selectedListId, setSelectedListId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    const last = typeof window !== "undefined" ? localStorage.getItem(LAST_BOARD_KEY) : null;
    const initial = boards.find((b) => b.id === last) ?? boards[0];
    setSelectedBoardId(initial?.id ?? null);
    setSelectedListId(initial?.lists[0]?.id ?? null);
    setQuery("");
  }, [open, boards]);

  const filteredBoards = useMemo(
    () => boards.filter((b) => b.name.toLowerCase().includes(query.toLowerCase())),
    [boards, query],
  );
  const selectedBoard = boards.find((b) => b.id === selectedBoardId);

  async function submit() {
    if (!todo || !selectedBoardId || !selectedListId) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/projekty/personal-todos/${todo.id}/promote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ boardId: selectedBoardId, listId: selectedListId }),
      });
      if (!res.ok) throw new Error("API error");
      const { card } = (await res.json()) as { card: { id: string } };
      if (typeof window !== "undefined") {
        localStorage.setItem(LAST_BOARD_KEY, selectedBoardId);
      }
      toast.success("Úkol přesunut do projektu", {
        action: {
          label: "Otevřít kartu",
          onClick: () => router.push(`/projekty/boards/${selectedBoardId}?card=${card.id}`),
        },
      });
      onOpenChange(false);
      router.refresh();
    } catch {
      toast.error("Přesun se nezdařil");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Přesunout úkol do projektu</DialogTitle>
        </DialogHeader>

        {boards.length === 0 ? (
          <div className="py-6 text-center text-sm text-muted-foreground">
            Nemáš žádný editovatelný board.
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block pb-1 text-xs font-medium text-muted-foreground">Board</label>
              <div className="relative pb-2">
                <Search className="absolute left-2 top-2.5 size-3.5 text-muted-foreground" />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Hledat board…"
                  className="w-full rounded border bg-background py-1.5 pl-7 pr-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>
              <div className="max-h-64 overflow-y-auto rounded border">
                {filteredBoards.length === 0 && (
                  <div className="p-3 text-xs text-muted-foreground">Žádný board.</div>
                )}
                {filteredBoards.map((b) => (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => {
                      setSelectedBoardId(b.id);
                      setSelectedListId(b.lists[0]?.id ?? null);
                    }}
                    className={cn(
                      "block w-full px-2 py-1.5 text-left text-sm hover:bg-accent",
                      selectedBoardId === b.id && "bg-accent font-medium",
                    )}
                  >
                    {b.name}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block pb-1 text-xs font-medium text-muted-foreground">Sloupec</label>
              <div className="max-h-72 overflow-y-auto rounded border">
                {(selectedBoard?.lists.length ?? 0) === 0 && (
                  <div className="p-3 text-xs text-muted-foreground">Board nemá sloupce.</div>
                )}
                {selectedBoard?.lists.map((l) => (
                  <button
                    key={l.id}
                    type="button"
                    onClick={() => setSelectedListId(l.id)}
                    className={cn(
                      "block w-full px-2 py-1.5 text-left text-sm hover:bg-accent",
                      selectedListId === l.id && "bg-accent font-medium",
                    )}
                  >
                    {l.name}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>
            Zrušit
          </Button>
          <Button
            onClick={() => void submit()}
            disabled={busy || !selectedBoardId || !selectedListId || boards.length === 0}
          >
            Přesunout
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
