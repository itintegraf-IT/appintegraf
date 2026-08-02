"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { format } from "date-fns";
import { cs } from "date-fns/locale";
import { Button } from "@/components/projekty/ui/button";
import { formatCalendarMonth, parseCalendarMonth } from "@/lib/projekty/board-view";

export function CalendarHeader() {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();

  const { year, month } = parseCalendarMonth(searchParams);
  const monthDate = new Date(year, month - 1, 1);
  const monthLabel = format(monthDate, "LLLL yyyy", { locale: cs });
  const monthLabelCapital = monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1);

  function navigate(delta: number) {
    const next = new Date(year, month - 1 + delta, 1);
    const sp = new URLSearchParams(searchParams.toString());
    sp.set("month", formatCalendarMonth({ year: next.getFullYear(), month: next.getMonth() + 1 }));
    router.replace(`${pathname}?${sp.toString()}`);
  }

  function goToday() {
    const now = new Date();
    const sp = new URLSearchParams(searchParams.toString());
    sp.set("month", formatCalendarMonth({ year: now.getFullYear(), month: now.getMonth() + 1 }));
    router.replace(`${pathname}?${sp.toString()}`);
  }

  return (
    <div className="flex items-center justify-between gap-3 border-b border-border bg-background px-3 py-2">
      <div className="flex items-center gap-1">
        <Button
          size="icon"
          variant="ghost"
          aria-label="Předchozí měsíc"
          onClick={() => navigate(-1)}
          className="size-7"
        >
          <ChevronLeft className="size-4" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          aria-label="Následující měsíc"
          onClick={() => navigate(1)}
          className="size-7"
        >
          <ChevronRight className="size-4" />
        </Button>
        <span className="ml-2 text-sm font-semibold text-foreground">
          {monthLabelCapital}
        </span>
      </div>
      <Button size="sm" variant="outline" onClick={goToday}>
        Dnes
      </Button>
    </div>
  );
}
