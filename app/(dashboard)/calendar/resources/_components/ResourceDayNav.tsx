"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight, Calendar } from "lucide-react";
import { formatDateLocal, parseDateLocal } from "../../lib/week-utils";

type Props = {
  day: string;
  basePath: string;
};

export function ResourceDayNav({ day, basePath }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const dayDate = parseDateLocal(day);

  const pushDay = (d: Date) => {
    const p = new URLSearchParams(searchParams.toString());
    p.set("view", "day");
    p.set("day", formatDateLocal(d));
    router.push(`${basePath}?${p}`);
  };

  const shift = (days: number) => {
    const d = new Date(dayDate);
    d.setDate(d.getDate() + days);
    pushDay(d);
  };

  const label = dayDate.toLocaleDateString("cs-CZ", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-4 rounded-lg border border-gray-200 bg-white p-4">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => shift(-1)}
          className="rounded-lg border border-gray-300 p-2 text-gray-700 hover:bg-gray-50"
          title="Předchozí den"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <h2 className="min-w-[200px] text-center text-lg font-semibold capitalize text-gray-900">
          {label}
        </h2>
        <button
          type="button"
          onClick={() => shift(1)}
          className="rounded-lg border border-gray-300 p-2 text-gray-700 hover:bg-gray-50"
          title="Další den"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>
      <button
        type="button"
        onClick={() => pushDay(new Date())}
        className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50"
      >
        <Calendar className="h-4 w-4" />
        Dnes
      </button>
    </div>
  );
}
