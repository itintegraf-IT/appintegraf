"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Clock, Percent, Eye } from "lucide-react";

type Question = {
  id: number;
  question: string;
  question_categories: { name: string; code: string };
};

export default function CreateTestPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [loadingQuestions, setLoadingQuestions] = useState(true);
  const [error, setError] = useState("");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [form, setForm] = useState({
    name: "",
    description: "",
    time_limit: "30",
    pass_percentage: "70",
    show_answers: true,
  });

  useEffect(() => {
    fetch("/api/training/questions")
      .then((r) => r.json())
      .then((data) => {
        setQuestions(data.questions ?? []);
      })
      .catch(() => setQuestions([]))
      .finally(() => setLoadingQuestions(false));
  }, []);

  const toggleQuestion = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/training/tests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          time_limit: parseInt(form.time_limit, 10) || 30,
          pass_percentage: parseInt(form.pass_percentage, 10) ?? 70,
          question_ids: Array.from(selectedIds),
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data.error ?? "Chyba při ukládání");
        setLoading(false);
        return;
      }

      router.push("/training?created=1");
      router.refresh();
    } catch {
      setError("Chyba při ukládání");
      setLoading(false);
    }
  };

  return (
    <>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Nový test</h1>
          <p className="mt-1 text-gray-600">Vytvoření nového testu pro zaměstnance</p>
        </div>
        <Link
          href="/training"
          className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50"
        >
          <ArrowLeft className="h-4 w-4" />
          Zpět
        </Link>
      </div>

      <form
        onSubmit={handleSubmit}
        className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm"
      >
        {error && (
          <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="mb-1 block text-sm font-medium text-gray-700">Název testu *</label>
            <input
              type="text"
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Např. IT Bezpečnost - Základy"
              className="w-full rounded-lg border border-gray-300 px-3 py-2"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-sm font-medium text-gray-700">Popis</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={3}
              placeholder="Krátký popis testu a jeho účelu"
              className="w-full rounded-lg border border-gray-300 px-3 py-2"
            />
          </div>
          <div>
            <label className="mb-1 flex items-center gap-1 text-sm font-medium text-gray-700">
              <Clock className="h-4 w-4" />
              Časový limit (min)
            </label>
            <input
              type="number"
              min={5}
              max={180}
              value={form.time_limit}
              onChange={(e) => setForm({ ...form, time_limit: e.target.value })}
              className="w-full rounded-lg border border-gray-300 px-3 py-2"
            />
            <p className="mt-1 text-xs text-gray-500">5–180 minut</p>
          </div>
          <div>
            <label className="mb-1 flex items-center gap-1 text-sm font-medium text-gray-700">
              <Percent className="h-4 w-4" />
              Minimální skóre (%)
            </label>
            <input
              type="number"
              min={0}
              max={100}
              value={form.pass_percentage}
              onChange={(e) => setForm({ ...form, pass_percentage: e.target.value })}
              className="w-full rounded-lg border border-gray-300 px-3 py-2"
            />
            <p className="mt-1 text-xs text-gray-500">Pro splnění testu</p>
          </div>
          <div className="flex items-center gap-2 sm:col-span-2">
            <input
              type="checkbox"
              id="show_answers"
              checked={form.show_answers}
              onChange={(e) => setForm({ ...form, show_answers: e.target.checked })}
              className="rounded"
            />
            <label htmlFor="show_answers" className="flex items-center gap-1 text-sm text-gray-700">
              <Eye className="h-4 w-4" />
              Zobrazit správné odpovědi po vyplnění
            </label>
          </div>

          <div className="sm:col-span-2">
            <label className="mb-2 block text-sm font-medium text-gray-700">
              Vybrat otázky (volitelné)
            </label>
            {loadingQuestions ? (
              <p className="text-sm text-gray-500">Načítání otázek…</p>
            ) : questions.length === 0 ? (
              <p className="text-sm text-gray-500">Žádné dostupné otázky. Test lze vytvořit prázdný.</p>
            ) : (
              <div className="max-h-48 overflow-y-auto rounded-lg border border-gray-200">
                {questions.map((q) => (
                  <label
                    key={q.id}
                    className="flex cursor-pointer items-start gap-2 border-b border-gray-100 p-2 last:border-0 hover:bg-gray-50"
                  >
                    <input
                      type="checkbox"
                      checked={selectedIds.has(q.id)}
                      onChange={() => toggleQuestion(q.id)}
                      className="mt-1 rounded"
                    />
                    <span className="text-sm">
                      <span className="font-medium text-gray-500">
                        [{q.question_categories?.code ?? "?"}]
                      </span>{" "}
                      {q.question.slice(0, 80)}
                      {q.question.length > 80 ? "…" : ""}
                    </span>
                  </label>
                ))}
              </div>
            )}
            <p className="mt-1 text-xs text-gray-500">
              Vybráno: {selectedIds.size} otázek. Prázdný test lze doplnit později.
            </p>
          </div>
        </div>

        <div className="mt-6 flex gap-2">
          <button
            type="submit"
            disabled={loading}
            className="rounded-lg bg-red-600 px-4 py-2 font-medium text-white hover:bg-red-700 disabled:opacity-50"
          >
            {loading ? "Vytvářím…" : "Vytvořit test"}
          </button>
          <Link
            href="/training"
            className="rounded-lg border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50"
          >
            Zrušit
          </Link>
        </div>
      </form>
    </>
  );
}
