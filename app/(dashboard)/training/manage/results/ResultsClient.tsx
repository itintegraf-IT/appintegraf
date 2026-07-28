"use client";

import { useCallback, useEffect, useState } from "react";
import { BarChart3, Download, CheckCircle, XCircle } from "lucide-react";

type AttemptRow = {
  id: number;
  test: { id: number; name: string; pass_percentage: number | null };
  user: { id: number; first_name: string; last_name: string; department_name: string | null };
  group: string | null;
  started_at: string;
  completed_at: string | null;
  score: number | null;
  passed: boolean | null;
  time_spent: number | null;
};

type StatRow = {
  test_id: number;
  name: string;
  attempts: number;
  passed: number;
  avg_score: number | null;
};

type TestOption = { id: number; name: string };

export function ResultsClient() {
  const [attempts, setAttempts] = useState<AttemptRow[]>([]);
  const [stats, setStats] = useState<StatRow[]>([]);
  const [tests, setTests] = useState<TestOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [filterTest, setFilterTest] = useState("");
  const [filterPassed, setFilterPassed] = useState("");

  const buildParams = useCallback(() => {
    const params = new URLSearchParams();
    if (filterTest) params.set("test_id", filterTest);
    if (filterPassed) params.set("passed", filterPassed);
    return params;
  }, [filterTest, filterPassed]);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [resultsRes, testsRes] = await Promise.all([
        fetch(`/api/training/results?${buildParams()}`),
        fetch("/api/training/tests"),
      ]);
      const resultsData = await resultsRes.json();
      const testsData = await testsRes.json();
      if (!resultsRes.ok) throw new Error(resultsData.error ?? "Chyba při načítání");
      setAttempts(resultsData.attempts ?? []);
      setStats(resultsData.stats ?? []);
      setTests(testsData.tests ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Chyba při načítání");
    } finally {
      setLoading(false);
    }
  }, [buildParams]);

  useEffect(() => {
    load();
  }, [load]);

  const exportCsv = () => {
    const params = buildParams();
    params.set("format", "csv");
    window.open(`/api/training/results?${params}`, "_blank");
  };

  const formatDateTime = (value: string) =>
    new Date(value).toLocaleString("cs-CZ", {
      day: "numeric",
      month: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

  const formatDuration = (seconds: number | null) => {
    if (seconds === null) return "–";
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  return (
    <>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900">
            <BarChart3 className="h-7 w-7 text-red-600" />
            Výsledky
          </h1>
          <p className="mt-1 text-gray-600">Vyhodnocení testů napříč uživateli</p>
        </div>
        <button
          type="button"
          onClick={exportCsv}
          className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 font-medium text-gray-700 hover:bg-gray-50"
        >
          <Download className="h-4 w-4" />
          Export CSV
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>
      )}

      {stats.length > 0 && (
        <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {stats.map((s) => (
            <div key={s.test_id} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <p className="truncate font-medium text-gray-900">{s.name}</p>
              <div className="mt-2 flex items-end justify-between">
                <div>
                  <p className="text-2xl font-bold text-gray-900">
                    {s.attempts > 0 ? Math.round((s.passed / s.attempts) * 100) : 0}%
                  </p>
                  <p className="text-xs text-gray-500">
                    úspěšnost ({s.passed}/{s.attempts} pokusů)
                  </p>
                </div>
                {s.avg_score !== null && (
                  <p className="text-sm text-gray-600">Ø {s.avg_score}%</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <select
          value={filterTest}
          onChange={(e) => setFilterTest(e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
        >
          <option value="">Všechny testy</option>
          {tests.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
        <select
          value={filterPassed}
          onChange={(e) => setFilterPassed(e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
        >
          <option value="">Vše</option>
          <option value="1">Jen splněné</option>
          <option value="0">Jen nesplněné</option>
        </select>
      </div>

      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
        {loading ? (
          <div className="px-4 py-12 text-center text-gray-500">Načítání…</div>
        ) : attempts.length === 0 ? (
          <div className="px-4 py-12 text-center text-gray-500">Žádné výsledky</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50 text-left text-gray-600">
                <th className="px-4 py-3 font-medium">Uživatel</th>
                <th className="px-4 py-3 font-medium">Test</th>
                <th className="px-4 py-3 font-medium">Skupina</th>
                <th className="px-4 py-3 font-medium">Datum</th>
                <th className="px-4 py-3 font-medium">Skóre</th>
                <th className="px-4 py-3 font-medium">Čas</th>
                <th className="px-4 py-3 font-medium">Výsledek</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {attempts.map((a) => (
                <tr key={a.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <span className="font-medium text-gray-900">
                      {a.user.first_name} {a.user.last_name}
                    </span>
                    {a.user.department_name && (
                      <span className="ml-1 text-xs text-gray-400">
                        ({a.user.department_name})
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-700">{a.test.name}</td>
                  <td className="px-4 py-3 text-gray-500">{a.group ?? "–"}</td>
                  <td className="px-4 py-3 text-gray-600">{formatDateTime(a.started_at)}</td>
                  <td className="px-4 py-3 text-gray-900">
                    {a.score === null ? "–" : `${a.score}%`}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{formatDuration(a.time_spent)}</td>
                  <td className="px-4 py-3">
                    {a.passed ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">
                        <CheckCircle className="h-3.5 w-3.5" /> Splněno
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-800">
                        <XCircle className="h-3.5 w-3.5" /> Nesplněno
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
