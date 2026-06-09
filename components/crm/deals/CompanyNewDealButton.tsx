"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DealQuickAddDialog } from "@/components/crm/deals/DealQuickAddDialog";
import type { CategoryOption } from "@/components/crm/deals/CategoryPicker";

type Props = {
  company: { id: string; name: string };
  categories: CategoryOption[];
  lost_reasons: { code: string; label: string }[];
};

export function CompanyNewDealButton({ company, categories, lost_reasons }: Props) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button type="button" size="sm" variant="outline" onClick={() => setOpen(true)}>
        <Plus className="mr-1 size-4" strokeWidth={1.75} />
        Nový deal
      </Button>
      <DealQuickAddDialog
        open={open}
        onOpenChange={setOpen}
        categories={categories}
        lost_reasons={lost_reasons}
        defaultStage="LEAD"
        preselectedCompany={company}
        onCreated={() => {
          /* router.refresh() je v DealQuickAddDialog, RSC se přenačte sám */
        }}
      />
    </>
  );
}
