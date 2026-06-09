"use client";
import * as React from "react";
import type { Route } from "next";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Search, X } from "lucide-react";
import { setFilter } from "@/lib/crm/deal-filters";
import { Input } from "@/components/ui/input";

export function SearchInput({ initialValue }: { initialValue: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [value, setValue] = React.useState(initialValue);
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  // sync z URL při navigaci zpět/vpřed
  React.useEffect(() => {
    setValue(initialValue);
  }, [initialValue]);

  function push(next: string) {
    const params = setFilter(new URLSearchParams(searchParams?.toString() ?? ""), { q: next });
    const qs = params.toString();
    router.replace((qs ? `${pathname}?${qs}` : pathname) as Route);
  }

  function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const next = e.target.value;
    setValue(next);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => push(next), 300);
  }

  function onClear() {
    if (timer.current) clearTimeout(timer.current);
    setValue("");
    push("");
  }

  return (
    <div className="relative flex-1 min-w-[180px] max-w-[320px]">
      <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
      <Input
        type="search"
        value={value}
        onChange={onChange}
        placeholder="Hledat firmu, deal, číslo…"
        className="h-8 pl-8 pr-8 text-sm"
        aria-label="Hledat v dealech"
      />
      {value.length > 0 && (
        <button
          type="button"
          onClick={onClear}
          aria-label="Vyčistit hledání"
          className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
        >
          <X className="size-4" />
        </button>
      )}
    </div>
  );
}
