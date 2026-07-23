"use client";

import { useState } from "react";
import { BoardCard, type BoardCardData } from "./BoardCard";
import { BoardCreateDialog } from "./BoardCreateDialog";
import { Plus } from "lucide-react";

export function BoardsGrid({ boards }: { boards: BoardCardData[] }) {
  const [openCreate, setOpenCreate] = useState(false);

  return (
    <>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        <button
          type="button"
          onClick={() => setOpenCreate(true)}
          className="flex min-h-[7.5rem] flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed bg-card text-sm font-medium text-muted-foreground transition-all hover:border-foreground hover:bg-muted/30 hover:text-foreground"
        >
          <Plus className="size-5" strokeWidth={1.75} />
          <span>Nový board</span>
        </button>
        {boards.map((b) => (
          <BoardCard key={b.id} board={b} />
        ))}
      </div>
      <BoardCreateDialog open={openCreate} onOpenChange={setOpenCreate} />
    </>
  );
}
