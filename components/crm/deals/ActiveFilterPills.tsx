"use client";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { X } from "lucide-react";
import type { DealFilters } from "@/lib/crm/deal-filters";
import { setFilter, clearFilters, NO_CATEGORY_SENTINEL } from "@/lib/crm/deal-filters";
import { STAGE_LABELS } from "@/lib/crm/deal-stages";
import type { Role } from "@/lib/crm/rbac";
import { Badge } from "@/components/ui/badge";
import type { Route } from "next";

type Props = {
  filters: DealFilters;
  users: { id: number; name: string | null }[];
  categories: { id: string; label: string }[];
  sessionRole: Role;
};

export function ActiveFilterPills({ filters, users, categories, sessionRole }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function currentParams(): URLSearchParams {
    return new URLSearchParams(searchParams?.toString() ?? "");
  }

  function push(params: URLSearchParams) {
    const qs = params.toString();
    router.replace((qs ? `${pathname}?${qs}` : pathname) as Route);
  }

  function clearAll() {
    const params = clearFilters(sessionRole);
    const qs = params.toString();
    router.replace((qs ? `${pathname}?${qs}` : pathname) as Route);
  }

  const pills: { key: string; label: string; onRemove: () => void }[] = [];

  if (filters.owner_ids.length > 0) {
    const labels = filters.owner_ids.map((id) => users.find((u) => String(u.id) === id)?.name ?? id);
    pills.push({
      key: "owner",
      label: `Vlastník: ${labels.join(", ")}`,
      onRemove: () => push(setFilter(currentParams(), { owner_ids: [] })),
    });
  }

  if (filters.category_ids.length > 0) {
    const labels = filters.category_ids.map((id) =>
      id === NO_CATEGORY_SENTINEL ? "(bez kategorie)" : categories.find((c) => c.id === id)?.label ?? id
    );
    pills.push({
      key: "category",
      label: `Kategorie: ${labels.join(", ")}`,
      onRemove: () => push(setFilter(currentParams(), { category_ids: [] })),
    });
  }

  if (filters.stages.length > 0) {
    pills.push({
      key: "stage",
      label: `Stage: ${filters.stages.map((s) => STAGE_LABELS[s]).join(", ")}`,
      onRemove: () => push(setFilter(currentParams(), { stages: [] })),
    });
  }

  if (filters.closeFrom || filters.closeTo) {
    const fmt = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : "");
    const dateLabel =
      filters.closeFrom && filters.closeTo
        ? `${fmt(filters.closeFrom)} – ${fmt(filters.closeTo)}`
        : filters.closeFrom
          ? `od ${fmt(filters.closeFrom)}`
          : `do ${fmt(filters.closeTo)}`;
    pills.push({
      key: "close",
      label: `Uzavření: ${dateLabel}`,
      onRemove: () => push(setFilter(currentParams(), { closeFrom: null, closeTo: null })),
    });
  }

  if (pills.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-md border-x border-b bg-muted/40 px-3 py-2 text-xs">
      <span className="font-semibold text-muted-foreground">Aktivní:</span>
      {pills.map((p) => (
        <Badge key={p.key} variant="secondary" className="gap-1 pr-1">
          {p.label}
          <button
            type="button"
            onClick={p.onRemove}
            aria-label={`Odstranit filtr: ${p.label}`}
            className="rounded-full p-0.5 hover:bg-muted-foreground/10"
          >
            <X className="size-3" aria-hidden />
          </button>
        </Badge>
      ))}
      <button
        type="button"
        onClick={clearAll}
        className="ml-auto text-muted-foreground hover:text-foreground hover:underline"
      >
        × Vyčistit
      </button>
    </div>
  );
}
