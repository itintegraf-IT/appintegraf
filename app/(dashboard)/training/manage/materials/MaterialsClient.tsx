"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  FileText,
  Plus,
  Pencil,
  Trash2,
  X,
  ExternalLink,
  Video,
  Presentation,
} from "lucide-react";
import {
  type MaterialType,
  materialTypeLabel,
  parseMaterialType,
} from "@/lib/training/material-types";
import type { MaterialFileMeta } from "@/lib/training/material-api";

type Category = { id: number; name: string; code: string; color: string | null };

type Material = {
  id: number;
  title: string;
  content: string;
  source: string | null;
  category_id: number | null;
  material_type: string;
  media_url: string | null;
  question_categories: Category | null;
  file: MaterialFileMeta | null;
};

type MaterialForm = {
  title: string;
  content: string;
  source: string;
  category_id: string;
  material_type: MaterialType;
  media_url: string;
};

const EMPTY_FORM: MaterialForm = {
  title: "",
  content: "",
  source: "",
  category_id: "",
  material_type: "text",
  media_url: "",
};

function TypeBadge({ type }: { type: MaterialType }) {
  const label = materialTypeLabel(type);
  const Icon = type === "video" ? Video : type === "presentation" ? Presentation : FileText;
  const colors =
    type === "video"
      ? "bg-purple-100 text-purple-800"
      : type === "presentation"
        ? "bg-blue-100 text-blue-800"
        : "bg-gray-100 text-gray-700";

  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${colors}`}>
      <Icon className="h-3 w-3" />
      {label}
    </span>
  );
}

function materialMeta(m: Material): string {
  const type = parseMaterialType(m.material_type);
  if (type === "text") return `${m.content.length} znaků`;
  if (type === "video") {
    if (m.media_url) return "Externí video";
    if (m.file) return m.file.original_filename;
    return "Bez média";
  }
  if (m.file) return m.file.original_filename;
  return "Bez souboru";
}

export function MaterialsClient() {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [editorOpen, setEditorOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<MaterialForm>(EMPTY_FORM);
  const [existingFile, setExistingFile] = useState<MaterialFileMeta | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  const [checkedIds, setCheckedIds] = useState<Set<number>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [materialsRes, categoriesRes] = await Promise.all([
        fetch("/api/training/materials"),
        fetch("/api/training/categories"),
      ]);
      const materialsData = await materialsRes.json();
      const categoriesData = await categoriesRes.json();
      if (!materialsRes.ok) throw new Error(materialsData.error ?? "Chyba při načítání");
      setMaterials(materialsData.materials ?? []);
      setCategories(categoriesData.categories ?? []);
      setCheckedIds(new Set());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Chyba při načítání");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const openCreate = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setExistingFile(null);
    setSelectedFile(null);
    setEditorOpen(true);
  };

  const openEdit = (m: Material) => {
    setEditingId(m.id);
    setForm({
      title: m.title,
      content: m.content,
      source: m.source ?? "",
      category_id: m.category_id?.toString() ?? "",
      material_type: parseMaterialType(m.material_type),
      media_url: m.media_url ?? "",
    });
    setExistingFile(m.file);
    setSelectedFile(null);
    setEditorOpen(true);
  };

  const uploadFile = async (materialId: number, file: File) => {
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch(`/api/training/materials/${materialId}/file`, {
      method: "POST",
      body: fd,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error ?? "Chyba při nahrávání souboru");
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");

    const type = form.material_type;
    const hasFile = Boolean(selectedFile || existingFile);

    if (type === "video" && !form.media_url.trim() && !hasFile) {
      setError("U videa nahrajte soubor (URL je volitelná)");
      setSaving(false);
      return;
    }
    if (type === "presentation" && !hasFile) {
      setError("U prezentace nahrajte soubor PDF nebo PPTX");
      setSaving(false);
      return;
    }
    if (type === "text" && !form.content.trim()) {
      setError("Vyplňte obsah textového materiálu");
      setSaving(false);
      return;
    }

    try {
      const payload = {
        title: form.title,
        content: form.content,
        source: form.source,
        category_id: form.category_id ? parseInt(form.category_id, 10) : null,
        material_type: type,
        media_url: type === "video" ? form.media_url.trim() || null : null,
        has_file: hasFile,
      };

      const res = await fetch(
        editingId ? `/api/training/materials/${editingId}` : "/api/training/materials",
        {
          method: editingId ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Chyba při ukládání");

      const materialId = editingId ?? data.id;
      if (selectedFile && materialId) {
        await uploadFile(materialId, selectedFile);
      }

      setEditorOpen(false);
      setNotice(editingId ? "Materiál uložen." : "Materiál vytvořen.");
      await load();
    } catch (e2) {
      setError(e2 instanceof Error ? e2.message : "Chyba při ukládání");
    } finally {
      setSaving(false);
    }
  };

  const removeExistingFile = async () => {
    if (selectedFile) {
      setSelectedFile(null);
      return;
    }
    if (!editingId) {
      setExistingFile(null);
      return;
    }
    if (!existingFile) return;
    if (!confirm("Odebrat nahraný soubor?")) return;
    setError("");
    const res = await fetch(`/api/training/materials/${editingId}/file`, { method: "DELETE" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error ?? "Chyba při odebírání souboru");
      return;
    }
    setExistingFile(null);
    setSelectedFile(null);
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
      prev.size === materials.length ? new Set() : new Set(materials.map((m) => m.id))
    );
  };

  const bulkDelete = async () => {
    if (checkedIds.size === 0) return;
    if (!confirm(`Smazat ${checkedIds.size} vybraných materiálů?`)) return;
    setBulkDeleting(true);
    setError("");
    setNotice("");
    try {
      const res = await fetch("/api/training/materials/bulk-delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: [...checkedIds] }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Chyba při hromadném mazání");
      setNotice(`Smazáno ${data.deleted} materiálů.`);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Chyba při hromadném mazání");
    } finally {
      setBulkDeleting(false);
    }
  };

  const remove = async (m: Material) => {
    if (!confirm(`Smazat materiál „${m.title}"?`)) return;
    setError("");
    const res = await fetch(`/api/training/materials/${m.id}`, { method: "DELETE" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error ?? "Chyba při mazání");
      return;
    }
    await load();
  };

  const showTextContent = form.material_type === "text";
  const showVideoFields = form.material_type === "video";
  const showPresentationFields = form.material_type === "presentation";
  const showDescription = form.material_type !== "text";

  return (
    <>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900">
            <FileText className="h-7 w-7 text-red-600" />
            Materiály
          </h1>
          <p className="mt-1 text-gray-600">Výukové materiály – texty, videa a prezentace</p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 font-medium text-white hover:bg-red-700"
        >
          <Plus className="h-4 w-4" />
          Nový materiál
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>
      )}
      {notice && (
        <div className="mb-4 rounded-lg bg-green-50 p-3 text-sm text-green-700">{notice}</div>
      )}

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        {loading ? (
          <div className="px-4 py-12 text-center text-gray-500">Načítání…</div>
        ) : materials.length === 0 ? (
          <div className="px-4 py-12 text-center text-gray-500">Žádné materiály</div>
        ) : (
          <>
            <div className="flex items-center justify-between border-b border-gray-200 bg-gray-50 px-4 py-2.5">
              <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={checkedIds.size === materials.length && materials.length > 0}
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
              {materials.map((m) => (
                <div
                  key={m.id}
                  className="flex items-start justify-between gap-3 px-4 py-3 hover:bg-gray-50"
                >
                  <input
                    type="checkbox"
                    checked={checkedIds.has(m.id)}
                    onChange={() => toggleChecked(m.id)}
                    className="mt-1.5 h-4 w-4 shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-gray-900">{m.title}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-gray-500">
                      <TypeBadge type={parseMaterialType(m.material_type)} />
                      {m.question_categories && (
                        <span
                          className="rounded-full px-2 py-0.5 font-medium text-white"
                          style={{ backgroundColor: m.question_categories.color ?? "#DC2626" }}
                        >
                          {m.question_categories.name}
                        </span>
                      )}
                      {m.source && <span>Zdroj: {m.source}</span>}
                      <span>{materialMeta(m)}</span>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <Link
                      href={`/training/material/${m.id}`}
                      className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"
                      title="Zobrazit"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </Link>
                    <button
                      type="button"
                      onClick={() => openEdit(m)}
                      className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"
                      title="Upravit"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => remove(m)}
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
                {editingId ? "Upravit materiál" : "Nový materiál"}
              </h2>
              <button
                type="button"
                onClick={() => setEditorOpen(false)}
                className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={save} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Typ materiálu</label>
                <select
                  value={form.material_type}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      material_type: parseMaterialType(e.target.value),
                    }))
                  }
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                >
                  <option value="text">Text</option>
                  <option value="video">Video</option>
                  <option value="presentation">Prezentace</option>
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Název *</label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  required
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Okruh</label>
                  <select
                    value={form.category_id}
                    onChange={(e) => setForm((f) => ({ ...f, category_id: e.target.value }))}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  >
                    <option value="">– bez okruhu –</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
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

              {showVideoFields && (
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    Soubor videa (MP4, WebM)
                  </label>
                  {(existingFile || selectedFile) && (
                    <div className="mb-2 flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm">
                      <span className="truncate">
                        {selectedFile?.name ?? existingFile?.original_filename}
                      </span>
                      <button
                        type="button"
                        onClick={removeExistingFile}
                        className="ml-2 shrink-0 text-red-600 hover:underline"
                      >
                        Odebrat
                      </button>
                    </div>
                  )}
                  <input
                    type="file"
                    accept="video/mp4,video/webm,.mp4,.webm"
                    onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)}
                    className="w-full text-sm"
                  />
                </div>
              )}

              {showVideoFields && (
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    Externí URL videa (volitelné)
                  </label>
                  <input
                    type="url"
                    value={form.media_url}
                    onChange={(e) => setForm((f) => ({ ...f, media_url: e.target.value }))}
                    placeholder="https://www.youtube.com/watch?v=…"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Použijte jen pokud video není nahrané v aplikaci. Při nahraném souboru má přednost soubor.
                  </p>
                </div>
              )}

              {showPresentationFields && (
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    Soubor prezentace (PDF, PPTX) *
                  </label>
                  {(existingFile || selectedFile) && (
                    <div className="mb-2 flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm">
                      <span className="truncate">
                        {selectedFile?.name ?? existingFile?.original_filename}
                      </span>
                      <button
                        type="button"
                        onClick={removeExistingFile}
                        className="ml-2 shrink-0 text-red-600 hover:underline"
                      >
                        Odebrat
                      </button>
                    </div>
                  )}
                  <input
                    type="file"
                    accept=".pdf,.pptx,application/pdf,application/vnd.openxmlformats-officedocument.presentationml.presentation"
                    onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)}
                    className="w-full text-sm"
                  />
                </div>
              )}

              {showTextContent && (
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Obsah *</label>
                  <textarea
                    value={form.content}
                    onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
                    rows={12}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 font-mono text-sm"
                    required
                  />
                </div>
              )}

              {showDescription && (
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    Popis (volitelný)
                  </label>
                  <textarea
                    value={form.content}
                    onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
                    rows={4}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                    placeholder="Krátký popis materiálu…"
                  />
                </div>
              )}

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
                  {saving ? "Ukládám…" : "Uložit materiál"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
