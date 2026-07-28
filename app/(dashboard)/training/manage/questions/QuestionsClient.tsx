"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  HelpCircle,
  Plus,
  Pencil,
  Trash2,
  X,
  Eye,
  EyeOff,
  Tags,
} from "lucide-react";

type Category = {
  id: number;
  name: string;
  code: string;
  color: string | null;
  is_active: boolean | null;
};

type Question = {
  id: number;
  category_id: number;
  question: string;
  option_a: string;
  option_b: string;
  option_c: string | null;
  option_d: string | null;
  correct_answer: "A" | "B" | "C" | "D";
  correct_answers: string | null;
  difficulty: "snadn_" | "st_edn_" | "t__k_" | null;
  explanation: string | null;
  source: string | null;
  is_active: boolean | null;
  question_categories: { id: number; name: string; code: string; color: string | null };
};

const DIFFICULTY_LABELS: Record<string, string> = {
  snadn_: "snadná",
  st_edn_: "střední",
  t__k_: "těžká",
};

type QuestionForm = {
  category_id: string;
  question: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_answers: string[];
  difficulty: string;
  explanation: string;
  source: string;
  is_active: boolean;
};

const EMPTY_FORM: QuestionForm = {
  category_id: "",
  question: "",
  option_a: "",
  option_b: "",
  option_c: "",
  option_d: "",
  correct_answers: ["A"],
  difficulty: "",
  explanation: "",
  source: "",
  is_active: true,
};

export function QuestionsClient() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [search, setSearch] = useState("");
  const [showInactive, setShowInactive] = useState(false);

  const [editorOpen, setEditorOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<QuestionForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const [checkedIds, setCheckedIds] = useState<Set<number>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [notice, setNotice] = useState("");

  const [categoriesOpen, setCategoriesOpen] = useState(false);
  const [categoryForm, setCategoryForm] = useState({ name: "", code: "", color: "#DC2626" });
  const [categorySaving, setCategorySaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (filterCategory) params.set("category_id", filterCategory);
      if (search.trim()) params.set("search", search.trim());
      if (showInactive) params.set("include_inactive", "1");
      const res = await fetch(`/api/training/questions?${params}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Chyba při načítání");
      setQuestions(data.questions ?? []);
      setCategories(data.categories ?? []);
      setCheckedIds(new Set());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Chyba při načítání");
    } finally {
      setLoading(false);
    }
  }, [filterCategory, search, showInactive]);

  useEffect(() => {
    const t = setTimeout(load, search ? 300 : 0);
    return () => clearTimeout(t);
  }, [load, search]);

  const openCreate = () => {
    setEditingId(null);
    setForm({ ...EMPTY_FORM, category_id: categories[0]?.id.toString() ?? "" });
    setEditorOpen(true);
  };

  const openEdit = (q: Question) => {
    setEditingId(q.id);
    setForm({
      category_id: String(q.category_id),
      question: q.question,
      option_a: q.option_a,
      option_b: q.option_b,
      option_c: q.option_c ?? "",
      option_d: q.option_d ?? "",
      correct_answers: (q.correct_answers?.trim() || q.correct_answer)
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      difficulty: q.difficulty ?? "",
      explanation: q.explanation ?? "",
      source: q.source ?? "",
      is_active: q.is_active !== false,
    });
    setEditorOpen(true);
  };

  const saveQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.correct_answers.length === 0) {
      setError("Vyberte alespoň jednu správnou odpověď");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const payload = {
        ...form,
        category_id: parseInt(form.category_id, 10),
        difficulty: form.difficulty || null,
        correct_answers: form.correct_answers.join(","),
      };
      const res = await fetch(
        editingId ? `/api/training/questions/${editingId}` : "/api/training/questions",
        {
          method: editingId ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Chyba při ukládání");
      setEditorOpen(false);
      await load();
    } catch (e2) {
      setError(e2 instanceof Error ? e2.message : "Chyba při ukládání");
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (q: Question) => {
    setError("");
    const res = await fetch(`/api/training/questions/${q.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_active: q.is_active === false }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Chyba při změně stavu");
      return;
    }
    await load();
  };

  const toggleChecked = (id: number) => {
    setCheckedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleCheckAll = () => {
    setCheckedIds((prev) =>
      prev.size === questions.length ? new Set() : new Set(questions.map((q) => q.id))
    );
  };

  const bulkDelete = async () => {
    if (checkedIds.size === 0) return;
    if (
      !confirm(
        `Smazat ${checkedIds.size} vybraných otázek? Otázky použité v testech budou pouze deaktivovány.`
      )
    ) {
      return;
    }
    setBulkDeleting(true);
    setError("");
    setNotice("");
    try {
      const res = await fetch("/api/training/questions/bulk-delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: [...checkedIds] }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Chyba při hromadném mazání");
      const parts: string[] = [];
      if (data.deleted > 0) parts.push(`smazáno ${data.deleted}`);
      if (data.deactivated > 0) parts.push(`deaktivováno ${data.deactivated} (použité v testech)`);
      setNotice(`Hotovo: ${parts.join(", ") || "žádná změna"}.`);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Chyba při hromadném mazání");
    } finally {
      setBulkDeleting(false);
    }
  };

  const deleteQuestion = async (q: Question) => {
    if (!confirm(`Smazat otázku „${q.question.slice(0, 60)}…“? Pokud je použitá v testech, bude pouze deaktivována.`)) {
      return;
    }
    setError("");
    const res = await fetch(`/api/training/questions/${q.id}`, { method: "DELETE" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error ?? "Chyba při mazání");
      return;
    }
    await load();
  };

  const saveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    setCategorySaving(true);
    setError("");
    try {
      const res = await fetch("/api/training/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(categoryForm),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Chyba při ukládání kategorie");
      setCategoryForm({ name: "", code: "", color: "#DC2626" });
      await load();
    } catch (e2) {
      setError(e2 instanceof Error ? e2.message : "Chyba při ukládání kategorie");
    } finally {
      setCategorySaving(false);
    }
  };

  const deleteCategory = async (c: Category) => {
    if (!confirm(`Smazat kategorii „${c.name}“?`)) return;
    setError("");
    const res = await fetch(`/api/training/categories/${c.id}`, { method: "DELETE" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error ?? "Chyba při mazání kategorie");
      return;
    }
    await load();
  };

  const activeCount = useMemo(
    () => questions.filter((q) => q.is_active !== false).length,
    [questions]
  );

  return (
    <>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900">
            <HelpCircle className="h-7 w-7 text-red-600" />
            Otázky
          </h1>
          <p className="mt-1 text-gray-600">
            {activeCount} aktivních z {questions.length} zobrazených
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setCategoriesOpen((v) => !v)}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 font-medium text-gray-700 hover:bg-gray-50"
          >
            <Tags className="h-4 w-4" />
            Kategorie
          </button>
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 font-medium text-white hover:bg-red-700"
          >
            <Plus className="h-4 w-4" />
            Nová otázka
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>
      )}
      {notice && (
        <div className="mb-4 rounded-lg bg-green-50 p-3 text-sm text-green-700">{notice}</div>
      )}

      {categoriesOpen && (
        <div className="mb-6 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <h2 className="mb-3 font-semibold text-gray-900">Správa kategorií</h2>
          <div className="mb-4 flex flex-wrap gap-2">
            {categories.map((c) => (
              <span
                key={c.id}
                className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium text-white"
                style={{ backgroundColor: c.color ?? "#DC2626" }}
              >
                {c.name} ({c.code})
                <button
                  type="button"
                  onClick={() => deleteCategory(c)}
                  className="rounded-full p-0.5 hover:bg-black/20"
                  title="Smazat kategorii"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </span>
            ))}
            {categories.length === 0 && (
              <span className="text-sm text-gray-500">Zatím žádné kategorie</span>
            )}
          </div>
          <form onSubmit={saveCategory} className="flex flex-wrap items-end gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Název</label>
              <input
                type="text"
                value={categoryForm.name}
                onChange={(e) => setCategoryForm((f) => ({ ...f, name: e.target.value }))}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
                required
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Kód</label>
              <input
                type="text"
                value={categoryForm.code}
                onChange={(e) =>
                  setCategoryForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))
                }
                className="w-32 rounded-lg border border-gray-300 px-3 py-2 text-sm"
                required
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Barva</label>
              <input
                type="color"
                value={categoryForm.color}
                onChange={(e) => setCategoryForm((f) => ({ ...f, color: e.target.value }))}
                className="h-9 w-14 cursor-pointer rounded-lg border border-gray-300"
              />
            </div>
            <button
              type="submit"
              disabled={categorySaving}
              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
            >
              {categorySaving ? "Ukládám…" : "Přidat kategorii"}
            </button>
          </form>
        </div>
      )}

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <input
          type="text"
          placeholder="Hledat v textu otázky…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-64 rounded-lg border border-gray-300 px-3 py-2 text-sm"
        />
        <select
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
        >
          <option value="">Všechny kategorie</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <label className="inline-flex items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={showInactive}
            onChange={(e) => setShowInactive(e.target.checked)}
            className="h-4 w-4"
          />
          Zobrazit i neaktivní
        </label>
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        {loading ? (
          <div className="px-4 py-12 text-center text-gray-500">Načítání…</div>
        ) : questions.length === 0 ? (
          <div className="px-4 py-12 text-center text-gray-500">Žádné otázky</div>
        ) : (
          <>
            <div className="flex items-center justify-between border-b border-gray-200 bg-gray-50 px-4 py-2.5">
              <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={checkedIds.size === questions.length && questions.length > 0}
                  onChange={toggleCheckAll}
                  className="h-4 w-4"
                />
                Vybrat vše
                {checkedIds.size > 0 && (
                  <span className="text-gray-500">({checkedIds.size} vybráno)</span>
                )}
              </label>
              {checkedIds.size > 0 && (
                <button
                  type="button"
                  onClick={bulkDelete}
                  disabled={bulkDeleting}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
                >
                  <Trash2 className="h-4 w-4" />
                  {bulkDeleting ? "Mažu…" : `Smazat vybrané (${checkedIds.size})`}
                </button>
              )}
            </div>
            <div className="divide-y divide-gray-100">
            {questions.map((q) => (
              <div key={q.id} className="flex items-start justify-between gap-3 px-4 py-3 hover:bg-gray-50">
                <input
                  type="checkbox"
                  checked={checkedIds.has(q.id)}
                  onChange={() => toggleChecked(q.id)}
                  className="mt-1.5 h-4 w-4 shrink-0"
                />
                <div className="min-w-0 flex-1">
                  <p className={`font-medium ${q.is_active === false ? "text-gray-400 line-through" : "text-gray-900"}`}>
                    {q.question}
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-gray-500">
                    <span
                      className="rounded-full px-2 py-0.5 font-medium text-white"
                      style={{ backgroundColor: q.question_categories.color ?? "#DC2626" }}
                    >
                      {q.question_categories.name}
                    </span>
                    <span>Správně: {q.correct_answers?.trim() || q.correct_answer}</span>
                    {q.difficulty && <span>Obtížnost: {DIFFICULTY_LABELS[q.difficulty]}</span>}
                    {q.source && <span>Zdroj: {q.source}</span>}
                    {q.is_active === false && (
                      <span className="rounded-full bg-gray-200 px-2 py-0.5 text-gray-600">neaktivní</span>
                    )}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    onClick={() => toggleActive(q)}
                    className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"
                    title={q.is_active === false ? "Aktivovat" : "Deaktivovat"}
                  >
                    {q.is_active === false ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                  </button>
                  <button
                    type="button"
                    onClick={() => openEdit(q)}
                    className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"
                    title="Upravit"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteQuestion(q)}
                    className="rounded-lg p-2 text-red-500 hover:bg-red-50"
                    title="Smazat"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
            </div>
          </>
        )}
      </div>

      {editorOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900">
                {editingId ? "Upravit otázku" : "Nová otázka"}
              </h2>
              <button
                type="button"
                onClick={() => setEditorOpen(false)}
                className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={saveQuestion} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Kategorie *</label>
                  <select
                    value={form.category_id}
                    onChange={(e) => setForm((f) => ({ ...f, category_id: e.target.value }))}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                    required
                  >
                    <option value="">– vyberte –</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Obtížnost</label>
                  <select
                    value={form.difficulty}
                    onChange={(e) => setForm((f) => ({ ...f, difficulty: e.target.value }))}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  >
                    <option value="">– neuvedeno –</option>
                    <option value="snadn_">snadná</option>
                    <option value="st_edn_">střední</option>
                    <option value="t__k_">těžká</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Text otázky *</label>
                <textarea
                  value={form.question}
                  onChange={(e) => setForm((f) => ({ ...f, question: e.target.value }))}
                  rows={2}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  required
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                {(["a", "b", "c", "d"] as const).map((key) => (
                  <div key={key}>
                    <label className="mb-1 block text-sm font-medium text-gray-700">
                      Možnost {key.toUpperCase()} {["a", "b"].includes(key) ? "*" : ""}
                    </label>
                    <input
                      type="text"
                      value={form[`option_${key}` as keyof QuestionForm] as string}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, [`option_${key}`]: e.target.value }))
                      }
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                      required={["a", "b"].includes(key)}
                    />
                  </div>
                ))}
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    Správné odpovědi * (lze více)
                  </label>
                  <div className="flex gap-3 rounded-lg border border-gray-300 px-3 py-2">
                    {(["A", "B", "C", "D"] as const).map((key) => (
                      <label key={key} className="inline-flex items-center gap-1.5 text-sm">
                        <input
                          type="checkbox"
                          checked={form.correct_answers.includes(key)}
                          onChange={() =>
                            setForm((f) => ({
                              ...f,
                              correct_answers: f.correct_answers.includes(key)
                                ? f.correct_answers.filter((k) => k !== key)
                                : [...f.correct_answers, key].sort(),
                            }))
                          }
                          className="h-4 w-4"
                        />
                        {key}
                      </label>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Zdroj</label>
                  <input
                    type="text"
                    value={form.source}
                    onChange={(e) => setForm((f) => ({ ...f, source: e.target.value }))}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Vysvětlení (zobrazí se po testu)
                </label>
                <textarea
                  value={form.explanation}
                  onChange={(e) => setForm((f) => ({ ...f, explanation: e.target.value }))}
                  rows={2}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
              </div>

              <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={form.is_active}
                  onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))}
                  className="h-4 w-4"
                />
                Aktivní (zveřejněná pro použití v testech)
              </label>

              <div className="flex justify-end gap-2 border-t border-gray-100 pt-4">
                <button
                  type="button"
                  onClick={() => setEditorOpen(false)}
                  className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Zrušit
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
                >
                  {saving ? "Ukládám…" : "Uložit otázku"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
