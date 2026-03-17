"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { ChevronsLeft, ChevronLeft, ChevronRight, ChevronsRight, Calendar } from "lucide-react";
import { formatWeekRange } from "./lib/week-utils";
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

  const shiftByDays = (days: number) => {
    const newFrom = new Date(fromDate);
    newFrom.setDate(newFrom.getDate() + days);
    const newTo = new Date(toDate);
    newTo.setDate(newTo.getDate() + days);
    updateWeekUrl(newFrom, newTo);
  };

  const goPrevWeek = () => shiftByDays(-7);
  const goNextWeek = () => shiftByDays(7);
  const goPrevDay = () => shiftByDays(-7);
  const goNextDay = () => shiftByDays(7);

  const goCurrent = () => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(today);
    todayEnd.setDate(todayEnd.getDate() + 6);
    updateWeekUrl(today, todayEnd);
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
          title="Předchozí týden"
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
          title="Další týden"
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
