"use client";

import { useState } from "react";
import { BellRing } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ReminderQuickAddDialog } from "./ReminderQuickAddDialog";

type Props = {
  company: { id: string; name: string };
};

export function CompanyReminderButton({ company }: Props) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button type="button" size="sm" variant="outline" onClick={() => setOpen(true)}>
        <BellRing className="mr-1 size-4" strokeWidth={1.75} />
        Připomenout se
      </Button>
      <ReminderQuickAddDialog
        open={open}
        onOpenChange={setOpen}
        parent={{ type: "COMPANY", id: company.id, name: company.name }}
      />
    </>
  );
}
