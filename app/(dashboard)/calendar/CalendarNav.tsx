"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight, Calendar } from "lucide-react";

type Props = {
  from: string;
  to: string;
};

export function CalendarNav({ from, to }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const fromDate = new Date(from);
  const toDate = new Date(to);

  const goPrev = () => {
    const prev = new Date(fromDate);
    prev.setMonth(prev.getMonth() - 1);
    const prevEnd = new Date(prev);
    prevEnd.setMonth(prevEnd.getMonth() + 1);
    prevEnd.setDate(0);
    const p = new URLSearchParams(searchParams.toString());
    p.set("from", prev.toISOString().slice(0, 10));
    p.set("to", prevEnd.toISOString().slice(0, 10));
    router.push(`/calendar?${p}`);
  };

  const goNext = () => {
    const next = new Date(fromDate);
    next.setMonth(next.getMonth() + 1);
    const nextEnd = new Date(next);
    nextEnd.setMonth(nextEnd.getMonth() + 1);
    nextEnd.setDate(0);
    const p = new URLSearchParams(searchParams.toString());
    p.set("from", next.toISOString().slice(0, 10));
    p.set("to", nextEnd.toISOString().slice(0, 10));
    router.push(`/calendar?${p}`);
  };

  const goCurrent = () => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const p = new URLSearchParams(searchParams.toString());
    p.set("from", start.toISOString().slice(0, 10));
    p.set("to", end.toISOString().slice(0, 10));
    router.push(`/calendar?${p}`);
  };

  const monthName = fromDate.toLocaleDateString("cs-CZ", {
    month: "long",
    year: "numeric",
  });

  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-4 rounded-lg border border-gray-200 bg-white p-4">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={goPrev}
          className="rounded-lg border border-gray-300 p-2 text-gray-700 hover:bg-gray-50"
          title="Předchozí měsíc"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <h2 className="min-w-[180px] text-center text-lg font-semibold text-gray-900">
          {monthName}
        </h2>
        <button
          type="button"
          onClick={goNext}
          className="rounded-lg border border-gray-300 p-2 text-gray-700 hover:bg-gray-50"
          title="Další měsíc"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>
      <button
        type="button"
        onClick={goCurrent}
        className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50"
      >
        <Calendar className="h-4 w-4" />
        Aktuální měsíc
      </button>
    </div>
  );
}
