"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight, Calendar, ChevronsLeft, ChevronsRight } from "lucide-react";
import { formatDateLocal, formatWeekRange, getWeekStart, parseDateLocal } from "../../lib/week-utils";

type Props = {
  weekFrom: string;
  weekTo: string;
  basePath: string;
};

export function ResourceWeekNav({ weekFrom, weekTo, basePath }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const fromDate = parseDateLocal(weekFrom);
  const toDate = parseDateLocal(weekTo);

  const pushWeek = (anchor: Date) => {
    const p = new URLSearchParams(searchParams.toString());
    p.set("view", "week");
    p.set("from", formatDateLocal(getWeekStart(anchor)));
    router.push(`${basePath}?${p}`);
  };

  const shiftWeek = (days: number) => {
    const d = new Date(fromDate);
    d.setDate(d.getDate() + days);
    pushWeek(d);
  };

  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-4 rounded-lg border border-gray-200 bg-white p-4">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => shiftWeek(-7)}
          className="rounded-lg border border-gray-300 p-2 text-gray-700 hover:bg-gray-50"
          title="Předchozí týden"
        >
          <ChevronsLeft className="h-5 w-5" />
        </button>
        <button
          type="button"
          onClick={() => shiftWeek(-1)}
          className="rounded-lg border border-gray-300 p-2 text-gray-700 hover:bg-gray-50"
          title="Předchozí den"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <h2 className="min-w-[220px] text-center text-lg font-semibold text-gray-900">
          {formatWeekRange(fromDate, toDate)}
        </h2>
        <button
          type="button"
          onClick={() => shiftWeek(1)}
          className="rounded-lg border border-gray-300 p-2 text-gray-700 hover:bg-gray-50"
          title="Další den"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
        <button
          type="button"
          onClick={() => shiftWeek(7)}
          className="rounded-lg border border-gray-300 p-2 text-gray-700 hover:bg-gray-50"
          title="Další týden"
        >
          <ChevronsRight className="h-5 w-5" />
        </button>
      </div>
      <button
        type="button"
        onClick={() => pushWeek(new Date())}
        className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50"
      >
        <Calendar className="h-4 w-4" />
        Tento týden
      </button>
    </div>
  );
}
