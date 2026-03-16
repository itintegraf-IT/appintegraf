"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { ChevronsLeft, ChevronLeft, ChevronRight, ChevronsRight, Calendar } from "lucide-react";
import { getPrevWeek, getNextWeek, getCurrentWeek, formatWeekRange } from "./lib/week-utils";
import { getPrevMonth, getNextMonth, getCurrentMonth, formatMonth } from "./lib/month-utils";

type Props = {
  view: "week" | "month";
  from: string;
  to: string;
  month?: string;
};

export function CalendarNav({ view, from, to, month }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const updateUrl = (params: Record<string, string>) => {
    const p = new URLSearchParams(searchParams.toString());
    Object.entries(params).forEach(([k, v]) => p.set(k, v));
    router.push(`/calendar?${p}`);
  };

  if (view === "month" && month) {
    const monthDate = new Date(month + "-01");

    const goPrevMonth = () => {
      const prev = getPrevMonth(monthDate);
      updateUrl({
        view: "month",
        month: `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, "0")}`,
      });
    };

    const goNextMonth = () => {
      const next = getNextMonth(monthDate);
      updateUrl({
        view: "month",
        month: `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}`,
      });
    };

    const goCurrent = () => {
      const now = getCurrentMonth();
      updateUrl({
        view: "month",
        month: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`,
      });
    };

    return (
      <div className="mb-4 flex flex-wrap items-center justify-between gap-4 rounded-lg border border-gray-200 bg-white p-4">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={goPrevMonth}
            className="rounded-lg border border-gray-300 p-2 text-gray-700 hover:bg-gray-50"
            title="Předchozí měsíc"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <h2 className="min-w-[200px] text-center text-lg font-semibold text-gray-900">
            {formatMonth(monthDate)}
          </h2>
          <button
            type="button"
            onClick={goNextMonth}
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
          Nyní
        </button>
      </div>
    );
  }

  const fromDate = new Date(from);
  const toDate = new Date(to);

  const updateWeekUrl = (newFrom: Date, newTo: Date) => {
    updateUrl({
      view: "week",
      from: newFrom.toISOString().slice(0, 10),
      to: newTo.toISOString().slice(0, 10),
    });
  };

  const goPrevWeek = () => {
    const { from: prevFrom, to: prevTo } = getPrevWeek(fromDate);
    updateWeekUrl(prevFrom, prevTo);
  };

  const goNextWeek = () => {
    const { from: nextFrom, to: nextTo } = getNextWeek(fromDate);
    updateWeekUrl(nextFrom, nextTo);
  };

  const goPrevDay = () => {
    const prev = new Date(fromDate);
    prev.setDate(prev.getDate() - 1);
    const prevEnd = new Date(prev);
    prevEnd.setDate(prevEnd.getDate() + 6);
    updateWeekUrl(prev, prevEnd);
  };

  const goNextDay = () => {
    const next = new Date(fromDate);
    next.setDate(next.getDate() + 1);
    const nextEnd = new Date(next);
    nextEnd.setDate(nextEnd.getDate() + 6);
    updateWeekUrl(next, nextEnd);
  };

  const goCurrent = () => {
    const { from: currFrom, to: currTo } = getCurrentWeek();
    updateWeekUrl(currFrom, currTo);
  };

  const weekLabel = formatWeekRange(fromDate, toDate);

  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-4 rounded-lg border border-gray-200 bg-white p-4">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={goPrevWeek}
          className="rounded-lg border border-gray-300 p-2 text-gray-700 hover:bg-gray-50"
          title="Předchozí týden"
        >
          <ChevronsLeft className="h-5 w-5" />
        </button>
        <button
          type="button"
          onClick={goPrevDay}
          className="rounded-lg border border-gray-300 p-2 text-gray-700 hover:bg-gray-50"
          title="O den zpět"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <h2 className="min-w-[200px] text-center text-lg font-semibold text-gray-900">
          {weekLabel}
        </h2>
        <button
          type="button"
          onClick={goNextDay}
          className="rounded-lg border border-gray-300 p-2 text-gray-700 hover:bg-gray-50"
          title="O den vpřed"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
        <button
          type="button"
          onClick={goNextWeek}
          className="rounded-lg border border-gray-300 p-2 text-gray-700 hover:bg-gray-50"
          title="Další týden"
        >
          <ChevronsRight className="h-5 w-5" />
        </button>
      </div>
      <button
        type="button"
        onClick={goCurrent}
        className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50"
      >
        <Calendar className="h-4 w-4" />
        Nyní
      </button>
    </div>
  );
}
