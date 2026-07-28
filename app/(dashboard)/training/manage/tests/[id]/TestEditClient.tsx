"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ClipboardList, Clock, Percent, Eye } from "lucide-react";

type Category = { id: number; name: string; code: string; color: string | null };

type Question = {
  id: number;
  question: string;
  correct_answer: string;
  is_active: boolean | null;
  question_categories: { id: number; name: string; code: string; color: string | null };
};

type Props = {
  testId: number | null;
};

export function TestEditClient({ testId }: Props) {
  const router = useRouter();
  const isNew = testId === null;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [filterCategory, setFilterCategory] = useState("");
  const [search, setSearch] = useState("");
  const [form, setForm] = useState({
    name: "",
    description: "",
    time_limit: "30",
    pass_percentage: "70",
    show_answers: true,
    is_active: true,
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const questionsRes = await fetch("/api/training/questions");
      const questionsData = await questionsRes.json();
      if (!questionsRes.ok) throw new Error(questionsData.error ?? "Chyba při načítání otázek");
      setQuestions(questionsData.questions ?? []);
      setCategories(questionsData.categories ?? []);

      if (testId !== null) {
        const testRes = await fetch(`/api/training/tests/${testId}`);
        const testData = await testRes.json();
        if (!testRes.ok) throw new Error(testData.error ?? "Chyba při načítání testu");
        const test = testData.test;
        setForm({
          name: test.name,
          description: test.description ?? "",
          time_limit: String(test.time_limit ?? 30),
          pass_percentage: String(test.pass_percentage ?? 70),
          show_answers: test.show_answers !== false,
          is_active: test.is_active !== false,
        });
        type TestQuestionRow = { question_id: number };
        setSelectedIds(
          (test.test_questions as TestQuestionRow[]).map((tq) => tq.question_id)
        );
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Chyba při načítání");
    } finally {
      setLoading(false);
    }
  }, [testId]);

  useEffect(() => {
    load();
  }, [load]);

  const toggleQuestion = (id: number) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const filteredQuestions = useMemo(() => {
    return questions.filter((q) => {
      if (filterCategory && String(q.question_categories.id) !== filterCategory) return false;
      if (search.trim() && !q.question.toLowerCase().includes(search.trim().toLowerCase())) {
        return false;
      }
      return true;
    });
  }, [questions, filterCategory, search]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSaving(true);

    try {
      const payload = {
        ...form,
        time_limit: parseInt(form.time_limit, 10) || 30,
        pass_percentage: parseInt(form.pass_percentage, 10) || 70,
        question_ids: selectedIds,
      };

      const res = await fetch(
        isNew ? "/api/training/tests" : `/api/training/tests/${testId}`,
        {
          method: isNew ? "POST" : "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Chyba při ukládání");

      router.push("/training/manage/tests");
      router.refresh();
    } catch (e2) {
      setError(e2 instanceof Error ? e2.message : "Chyba při ukládání");
      setSaving(false);
    }
  };

  return (
    <>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900">
            <ClipboardList className="h-7 w-7 text-red-600" />
            {isNew ? "Nový test" : "Upravit test"}
          </h1>
          <p className="mt-1 text-gray-600">
            Vybráno {selectedIds.length} otázek
          </p>
        </div>
        <Link
          href="/training/manage/tests"
          className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50"
        >
          <ArrowLeft className="h-4 w-4" />
          Zpět
        </Link>
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>
      )}

      {loading ? (
        <div className="rounded-xl border border-gray-200 bg-white p-12 text-center text-gray-500">
          Načítání…
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-4 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="font-semibold text-gray-900">Nastavení testu</h2>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Název *</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                required
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Popis</label>
              <textarea
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                rows={3}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 flex items-center gap-1 text-sm font-medium text-gray-700">
                  <Clock className="h-4 w-4" /> Časový limit (min)
                </label>
                <input
                  type="number"
                  min={5}
                  max={180}
                  value={form.time_limit}
                  onChange={(e) => setForm((f) => ({ ...f, time_limit: e.target.value }))}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 flex items-center gap-1 text-sm font-medium text-gray-700">
                  <Percent className="h-4 w-4" /> Min. % pro splnění
                </label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={form.pass_percentage}
                  onChange={(e) => setForm((f) => ({ ...f, pass_percentage: e.target.value }))}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
            </div>

            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={form.show_answers}
                onChange={(e) => setForm((f) => ({ ...f, show_answers: e.target.checked }))}
                className="h-4 w-4"
              />
              <Eye className="h-4 w-4" />
              Po dokončení zobrazit správné odpovědi a vysvětlení
            </label>

            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={form.is_active}
                onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))}
                className="h-4 w-4"
              />
              Aktivní (zveřejněný test)
            </label>

            <div className="border-t border-gray-100 pt-4">
              <button
                type="submit"
                disabled={saving || !form.name.trim() || selectedIds.length === 0}
                className="w-full rounded-lg bg-red-600 px-4 py-2.5 font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                {saving ? "Ukládám…" : isNew ? "Vytvořit test" : "Uložit změny"}
              </button>
              {selectedIds.length === 0 && (
                <p className="mt-2 text-center text-xs text-gray-500">
                  Vyberte alespoň jednu otázku
                </p>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
            <div className="border-b border-gray-200 bg-gray-50 px-4 py-3">
              <h2 className="font-semibold text-gray-900">Výběr otázek</h2>
              <div className="mt-2 flex gap-2">
                <input
                  type="text"
                  placeholder="Hledat…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="flex-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
                />
                <select
                  value={filterCategory}
                  onChange={(e) => setFilterCategory(e.target.value)}
                  className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
                >
                  <option value="">Všechny kategorie</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="max-h-[32rem] divide-y divide-gray-100 overflow-y-auto">
              {filteredQuestions.length === 0 ? (
                <div className="px-4 py-8 text-center text-gray-500">
                  Žádné otázky – nejprve je vytvořte nebo importujte
                </div>
              ) : (
                filteredQuestions.map((q) => (
                  <label
                    key={q.id}
                    className="flex cursor-pointer items-start gap-3 px-4 py-2.5 hover:bg-gray-50"
                  >
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(q.id)}
                      onChange={() => toggleQuestion(q.id)}
                      className="mt-1 h-4 w-4"
                    />
                    <div className="min-w-0">
                      <p className="text-sm text-gray-900">{q.question}</p>
                      <span
                        className="mt-0.5 inline-block rounded-full px-2 py-0.5 text-xs font-medium text-white"
                        style={{ backgroundColor: q.question_categories.color ?? "#DC2626" }}
                      >
                        {q.question_categories.name}
                      </span>
                    </div>
                  </label>
                ))
              )}
            </div>
          </div>
        </form>
      )}
    </>
  );
}
