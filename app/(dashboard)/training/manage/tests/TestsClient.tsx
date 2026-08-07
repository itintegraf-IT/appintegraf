"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ClipboardList, Plus, Pencil, Trash2, Eye, EyeOff } from "lucide-react";

type TestRow = {
  id: number;
  name: string;
  description: string | null;
  time_limit: number | null;
  pass_percentage: number | null;
  show_answers: boolean | null;
  is_active: boolean | null;
  created_at: string;
  users: { first_name: string; last_name: string };
  _count: { test_questions: number; test_attempts: number; test_assignments: number };
};

export function TestsClient() {
  const [tests, setTests] = useState<TestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/training/tests");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Chyba při načítání");
      setTests(data.tests ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Chyba při načítání");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const toggleActive = async (t: TestRow) => {
    setError("");
    const res = await fetch(`/api/training/tests/${t.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_active: t.is_active === false }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Chyba při změně stavu");
      return;
    }
    await load();
  };

  const remove = async (t: TestRow) => {
    if (
      !confirm(
        `Smazat test „${t.name}“? Pokud už má odevzdané pokusy, bude pouze deaktivován.`
      )
    ) {
      return;
    }
    setError("");
    const res = await fetch(`/api/training/tests/${t.id}`, { method: "DELETE" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error ?? "Chyba při mazání");
      return;
    }
    await load();
  };

  return (
    <>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900">
            <ClipboardList className="h-7 w-7 text-red-600" />
            Testy
          </h1>
          <p className="mt-1 text-gray-600">Definice testů a výběr otázek</p>
        </div>
        <Link
          href="/training/manage/tests/new"
          className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 font-medium text-white hover:bg-red-700"
        >
          <Plus className="h-4 w-4" />
          Nový test
        </Link>
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>
      )}

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        {loading ? (
          <div className="px-4 py-12 text-center text-gray-500">Načítání…</div>
        ) : tests.length === 0 ? (
          <div className="px-4 py-12 text-center text-gray-500">Žádné testy</div>
        ) : (
          <div className="divide-y divide-gray-100">
            {tests.map((t) => (
              <div key={t.id} className="flex items-start justify-between gap-3 px-4 py-3 hover:bg-gray-50">
                <div className="min-w-0">
                  <p className={`font-medium ${t.is_active === false ? "text-gray-400 line-through" : "text-gray-900"}`}>
                    {t.name}
                  </p>
                  {t.description && (
                    <p className="text-sm text-gray-500 line-clamp-1">{t.description}</p>
                  )}
                  <p className="mt-1 text-xs text-gray-400">
                    {t._count.test_questions} otázek | {t.time_limit ?? 30} min | min.{" "}
                    {t.pass_percentage ?? 70}% | {t._count.test_attempts} pokusů |{" "}
                    {t._count.test_assignments} přiřazení
                    {t.show_answers && " | zobrazuje odpovědi"}
                    {t.is_active === false && (
                      <span className="ml-2 rounded-full bg-gray-200 px-2 py-0.5 text-gray-600">
                        neaktivní
                      </span>
                    )}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    onClick={() => toggleActive(t)}
                    className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"
                    title={t.is_active === false ? "Aktivovat" : "Deaktivovat"}
                  >
                    {t.is_active === false ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                  </button>
                  <Link
                    href={`/training/manage/tests/${t.id}`}
                    className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"
                    title="Upravit"
                  >
                    <Pencil className="h-4 w-4" />
                  </Link>
                  <button
                    type="button"
                    onClick={() => remove(t)}
                    className="rounded-lg p-2 text-red-500 hover:bg-red-50"
                    title="Smazat"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
