"use client";

import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { formatWeekRange, parseDateLocal, formatDateLocal } from "@/app/(dashboard)/calendar/lib/week-utils";

type Props = {
  from: string;
  to: string;
};

export function MaketyCalendarNav({ from, to }: Props) {
  const fromDate = parseDateLocal(from);
  const prevFrom = new Date(fromDate);
  prevFrom.setDate(prevFrom.getDate() - 7);
  const nextFrom = new Date(fromDate);
  nextFrom.setDate(nextFrom.getDate() + 7);
  const prevTo = new Date(prevFrom);
  prevTo.setDate(prevTo.getDate() + 6);
  const nextTo = new Date(nextFrom);
  nextTo.setDate(nextTo.getDate() + 6);

  const link = (f: string, t: string) =>
    `/makety/kalendar?from=${f}&to=${t}`;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3">
      <div className="flex items-center gap-2">
        <Link
          href={link(formatDateLocal(prevFrom), formatDateLocal(prevTo))}
          className="rounded-lg border border-gray-300 p-2 hover:bg-gray-50"
          aria-label="Předchozí týden"
        >
          <ChevronLeft className="h-4 w-4" />
        </Link>
        <span className="text-sm font-medium text-gray-800">
          {formatWeekRange(parseDateLocal(from), parseDateLocal(to))}
        </span>
        <Link
          href={link(formatDateLocal(nextFrom), formatDateLocal(nextTo))}
          className="rounded-lg border border-gray-300 p-2 hover:bg-gray-50"
          aria-label="Další týden"
        >
          <ChevronRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}
