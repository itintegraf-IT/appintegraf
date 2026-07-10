"use client";

import { useRouter, useSearchParams } from "next/navigation";
import type { ResourceScheduleView } from "@/lib/resource-schedule-params";

type Props = {
  view: ResourceScheduleView;
  basePath: string;
};

export function ResourceViewToggle({ view, basePath }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const setView = (next: ResourceScheduleView) => {
    const p = new URLSearchParams(searchParams.toString());
    p.set("view", next);
    router.push(`${basePath}?${p}`);
  };

  const tabClass = (active: boolean) =>
    `rounded-md px-4 py-2 text-sm font-medium transition-colors ${
      active ? "bg-red-600 text-white shadow-sm" : "text-gray-600 hover:bg-gray-100"
    }`;

  return (
    <div className="mb-4 flex gap-1 rounded-lg border border-gray-200 bg-white p-1 w-fit">
      <button type="button" onClick={() => setView("week")} className={tabClass(view === "week")}>
        Týden
      </button>
      <button type="button" onClick={() => setView("day")} className={tabClass(view === "day")}>
        Den
      </button>
    </div>
  );
}
