"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { CalendarDays, CalendarRange, User, Globe } from "lucide-react";
import { formatDateLocal } from "./lib/week-utils";

type ViewType = "week" | "month" | "list_mine" | "list_all";

type Props = {
  view: ViewType;
};

export function CalendarViewToggle({ view }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const setView = (newView: ViewType) => {
    const p = new URLSearchParams(searchParams.toString());
    p.set("view", newView);
    if (newView === "month") {
      const now = new Date();
      p.set("month", `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`);
      p.delete("from");
      p.delete("to");
      p.delete("list_from");
      p.delete("list_to");
    } else if (newView === "list_mine" || newView === "list_all") {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const listTo = new Date(today);
      listTo.setDate(listTo.getDate() + 13);
      p.set("list_from", formatDateLocal(today));
      p.set("list_to", formatDateLocal(listTo));
      p.delete("month");
      p.delete("from");
      p.delete("to");
    } else {
      p.delete("month");
      p.delete("list_from");
      p.delete("list_to");
    }
    router.push(`/calendar?${p}`);
  };

  return (
    <div className="flex flex-wrap gap-1 rounded-lg border border-gray-200 bg-white p-1">
      <button
        type="button"
        onClick={() => setView("week")}
        className={`inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
          view === "week" ? "bg-red-600 text-white shadow-sm" : "text-gray-600 hover:bg-gray-100"
        }`}
      >
        <CalendarRange className="h-4 w-4" />
        Týden
      </button>
      <button
        type="button"
        onClick={() => setView("month")}
        className={`inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
          view === "month" ? "bg-red-600 text-white shadow-sm" : "text-gray-600 hover:bg-gray-100"
        }`}
      >
        <CalendarDays className="h-4 w-4" />
        Měsíc
      </button>
      <button
        type="button"
        onClick={() => setView("list_mine")}
        className={`inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
          view === "list_mine" ? "bg-red-600 text-white shadow-sm" : "text-gray-600 hover:bg-gray-100"
        }`}
      >
        <User className="h-4 w-4" />
        Seznam osobní
      </button>
      <button
        type="button"
        onClick={() => setView("list_all")}
        className={`inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
          view === "list_all" ? "bg-red-600 text-white shadow-sm" : "text-gray-600 hover:bg-gray-100"
        }`}
      >
        <Globe className="h-4 w-4" />
        Seznam globální
      </button>
    </div>
  );
}
