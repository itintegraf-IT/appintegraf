"use client";

import { useState } from "react";
import { BellRing } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ReminderQuickAddDialog } from "./ReminderQuickAddDialog";

type Props = {
  deal: { id: string; title: string };
  variant?: "default" | "outline" | "ghost";
  size?: "default" | "sm" | "icon" | "lg";
};

export function DealReminderButton({ deal, variant = "outline", size = "sm" }: Props) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button type="button" size={size} variant={variant} onClick={() => setOpen(true)}>
        <BellRing className="mr-1 size-4" strokeWidth={1.75} />
        Připomenout se
      </Button>
      <ReminderQuickAddDialog
        open={open}
        onOpenChange={setOpen}
        parent={{ type: "DEAL", id: deal.id, name: deal.title }}
      />
    </>
  );
}
