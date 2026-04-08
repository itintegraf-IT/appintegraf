"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { User } from "lucide-react";

export type CalendarTabScope = "all" | "mine";

type Props = {
  scope: CalendarTabScope;
};

export function CalendarTabs({ scope }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const pushParams = (mutate: (p: URLSearchParams) => void) => {
    const p = new URLSearchParams(searchParams.toString());
    mutate(p);
    router.push(`/calendar?${p}`);
  };

  const setScope = (newScope: CalendarTabScope) => {
    pushParams((p) => {
      p.set("scope", newScope);
      p.delete("dept_id");
    });
  };

  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      <div className="flex gap-1 rounded-lg border border-gray-200 bg-white p-1">
        <button
          type="button"
          onClick={() => setScope("all")}
          className={`inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
            scope === "all"
              ? "bg-red-600 text-white shadow-sm"
              : "text-gray-600 hover:bg-gray-100"
          }`}
        >
          <span className="h-2 w-2 rounded-full bg-current" />
          Globální kalendář
        </button>
        <button
          type="button"
          onClick={() => setScope("mine")}
          className={`inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
            scope === "mine"
              ? "bg-red-600 text-white shadow-sm"
              : "text-gray-600 hover:bg-gray-100"
          }`}
        >
          <User className="h-4 w-4" />
          Osobní kalendář
        </button>
      </div>
    </div>
  );
}
