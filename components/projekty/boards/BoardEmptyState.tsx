"use client";

import { useState } from "react";
import { Button } from "@/components/projekty/ui/button";
import { Plus } from "lucide-react";
import { BoardCreateDialog } from "./BoardCreateDialog";

export function BoardEmptyState() {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed py-20 text-muted-foreground">
      <p>Zatím žádné boardy.</p>
      <Button onClick={() => setOpen(true)}>
        <Plus className="mr-2 size-4" />
        Vytvořit první board
      </Button>
      <BoardCreateDialog open={open} onOpenChange={setOpen} />
    </div>
  );
}
