"use client";

import { useState } from "react";
import { QuickAddButton } from "@/components/crm/deals/QuickAddButton";
import { DealQuickAddDialog } from "@/components/crm/deals/DealQuickAddDialog";
import type { CategoryOption } from "@/components/crm/deals/CategoryPicker";

export function DealsListQuickAdd({
  categories,
  lost_reasons,
}: {
  categories: CategoryOption[];
  lost_reasons: { code: string; label: string }[];
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <QuickAddButton onClick={() => setOpen(true)} label="Nový deal" />
      <DealQuickAddDialog
        open={open}
        onOpenChange={setOpen}
        categories={categories}
        lost_reasons={lost_reasons}
        defaultStage="LEAD"
        onCreated={() => {
          /* router.refresh() je v DealQuickAddDialog, RSC se přenačte sám */
        }}
      />
    </>
  );
}
