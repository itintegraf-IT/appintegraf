"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, ClipboardList, UserPlus, Users } from "lucide-react";

type OverviewData = {
  candidates: {
    new: number;
    in_review: number;
    invited: number;
    accepted: number;
    rejected: number;
  };
  incompleteOnboarding: Array<{ id: number; name: string; done: number; total: number }>;
  upcomingExits: Array<{ id: number; name: string; end_date: string }>;
};

export function PersonalistikaOverviewPanel({
  onOpenEmployee,
  onOpenApplications,
}: {
  onOpenEmployee: (employeeId: number) => void;
  onOpenApplications: (status?: string) => void;
}) {
  const [data, setData] = useState<OverviewData | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setError("");
    const res = await fetch("/api/personalistika/overview");
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(json.error ?? "Přehled se nepodařilo načíst.");
      return;
    }
    setData(json as OverviewData);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (error) {
    return <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>;
  }
  if (!data) {
    return <p className="text-sm text-gray-500">Načítám přehled…</p>;
  }

  const waitingCandidates = data.candidates.new + data.candidates.in_review + data.candidates.invited;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <button
          type="button"
          onClick={() => onOpenApplications("new")}
          className="rounded-xl border border-gray-200 bg-white p-4 text-left shadow-sm hover:bg-gray-50"
        >
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-gray-500">
            <UserPlus className="h-4 w-4 text-red-600" />
            Uchazeči čekají
          </div>
          <p className="mt-2 text-2xl font-semibold text-gray-900">{waitingCandidates}</p>
          <p className="mt-1 text-xs text-gray-500">
            Noví {data.candidates.new} · V řešení {data.candidates.in_review} · Pozváni{" "}
            {data.candidates.invited}
          </p>
        </button>
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-gray-500">
            <ClipboardList className="h-4 w-4 text-amber-600" />
            Neúplný nástup
          </div>
          <p className="mt-2 text-2xl font-semibold text-gray-900">{data.incompleteOnboarding.length}</p>
          <p className="mt-1 text-xs text-gray-500">Aktivní zaměstnanci s otevřeným checklistem</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-gray-500">
            <AlertTriangle className="h-4 w-4 text-orange-600" />
            Blížící se výstup
          </div>
          <p className="mt-2 text-2xl font-semibold text-gray-900">{data.upcomingExits.length}</p>
          <p className="mt-1 text-xs text-gray-500">Do 30 dnů (nebo dříve)</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-gray-500">
            <Users className="h-4 w-4 text-gray-600" />
            Přijatí uchazeči
          </div>
          <p className="mt-2 text-2xl font-semibold text-gray-900">{data.candidates.accepted}</p>
          <p className="mt-1 text-xs text-gray-500">Status accepted v náboru</p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-900">Neúplný nástup</h2>
          <ul className="mt-3 divide-y divide-gray-100">
            {data.incompleteOnboarding.length === 0 ? (
              <li className="py-3 text-sm text-gray-500">Nic nečeká.</li>
            ) : (
              data.incompleteOnboarding.map((e) => (
                <li key={e.id} className="flex items-center justify-between gap-2 py-2">
                  <button
                    type="button"
                    onClick={() => onOpenEmployee(e.id)}
                    className="text-left text-sm font-medium text-gray-900 hover:underline"
                  >
                    {e.name}
                  </button>
                  <span className="text-xs text-amber-700">
                    {e.done}/{e.total}
                  </span>
                </li>
              ))
            )}
          </ul>
        </section>
        <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-900">Blížící se výstup</h2>
          <ul className="mt-3 divide-y divide-gray-100">
            {data.upcomingExits.length === 0 ? (
              <li className="py-3 text-sm text-gray-500">Nic nečeká.</li>
            ) : (
              data.upcomingExits.map((e) => (
                <li key={e.id} className="flex items-center justify-between gap-2 py-2">
                  <button
                    type="button"
                    onClick={() => onOpenEmployee(e.id)}
                    className="text-left text-sm font-medium text-gray-900 hover:underline"
                  >
                    {e.name}
                  </button>
                  <span className="text-xs text-gray-600">{e.end_date}</span>
                </li>
              ))
            )}
          </ul>
        </section>
      </div>
    </div>
  );
}
