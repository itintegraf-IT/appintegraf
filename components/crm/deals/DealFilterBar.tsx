"use client";
import type { DealFilters } from "@/lib/crm/deal-filters";
import { SearchInput } from "@/components/crm/deals/filters/SearchInput";
import { MineToggle } from "@/components/crm/deals/filters/MineToggle";
import { OwnerPopover } from "@/components/crm/deals/filters/OwnerPopover";
import { CategoryPopover } from "@/components/crm/deals/filters/CategoryPopover";
import { StagePopover } from "@/components/crm/deals/filters/StagePopover";
import { CloseDatePopover } from "@/components/crm/deals/filters/CloseDatePopover";

type Props = {
  filters: DealFilters;
  users: { id: number; name: string | null; email: string | null; image: string | null }[];
  categories: { id: string; code: string; label: string; color: string | null }[];
  view?: "kanban" | "listing";
};

export function DealFilterBar({ filters, users, categories, view = "kanban" }: Props) {
  return (
    <div className="flex flex-nowrap items-center gap-2 overflow-x-auto rounded-md border bg-background p-2">
      <SearchInput initialValue={filters.q} />
      <span className="h-5 w-px shrink-0 bg-border" aria-hidden />
      <MineToggle active={filters.mine} />
      <OwnerPopover
        users={users}
        selected={filters.owner_ids}
        muted={filters.mine}
      />
      <CategoryPopover categories={categories} selected={filters.category_ids} />
      {view === "listing" && <StagePopover selected={filters.stages} />}
      <CloseDatePopover closeFrom={filters.closeFrom} closeTo={filters.closeTo} />
    </div>
  );
}
