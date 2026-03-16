"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { CalendarDays, CalendarRange } from "lucide-react";

type Props = {
  view: "week" | "month";
};

export function CalendarViewToggle({ view }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const setView = (newView: "week" | "month") => {
    const p = new URLSearchParams(searchParams.toString());
    p.set("view", newView);
    if (newView === "month") {
      const now = new Date();
      p.set("month", `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`);
      p.delete("from");
      p.delete("to");
    } else {
      p.delete("month");
    }
    router.push(`/calendar?${p}`);
  };

  return (
    <div className="flex gap-1 rounded-lg border border-gray-200 bg-white p-1">
      <button
        type="button"
        onClick={() => setView("week")}
        className={`inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
          view === "week"
            ? "bg-red-600 text-white shadow-sm"
            : "text-gray-600 hover:bg-gray-100"
        }`}
      >
        <CalendarRange className="h-4 w-4" />
        Týden
      </button>
      <button
        type="button"
        onClick={() => setView("month")}
        className={`inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
          view === "month"
            ? "bg-red-600 text-white shadow-sm"
            : "text-gray-600 hover:bg-gray-100"
        }`}
      >
        <CalendarDays className="h-4 w-4" />
        Měsíc
      </button>
    </div>
  );
}
