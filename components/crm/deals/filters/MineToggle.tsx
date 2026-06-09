"use client";
import type { Route } from "next";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { setFilter } from "@/lib/crm/deal-filters";

export function MineToggle({ active }: { active: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function onToggle() {
    const params = setFilter(new URLSearchParams(searchParams?.toString() ?? ""), { mine: !active });
    const qs = params.toString();
    router.replace((qs ? `${pathname}?${qs}` : pathname) as Route);
  }

  return (
    <Button
      type="button"
      variant={active ? "default" : "outline"}
      size="sm"
      onClick={onToggle}
      aria-pressed={active}
      className="rounded-full"
    >
      Moje OP
    </Button>
  );
}
