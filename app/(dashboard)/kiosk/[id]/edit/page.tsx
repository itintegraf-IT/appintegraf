"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter, useParams } from "next/navigation";
import { ArrowLeft, Upload, Trash2, Image } from "lucide-react";

type Slide = {
  id: number;
  filename: string;
  file_path: string;
  file_type: string;
  title: string | null;
  duration: number | null;
  visible: boolean | null;
  sort_order: number | null;
};

type Presentation = {
  id: number;
  name: string;
  description: string | null;
  transition_effect: string | null;
  transition_time: number | null;
  display_duration: number | null;
  is_active: boolean | null;
  slides: Slide[];
};

export default function KioskEditPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [slides, setSlides] = useState<Slide[]>([]);
  const [form, setForm] = useState({
    name: "",
    description: "",
    transition_effect: "fade",
    transition_time: "5",
    display_duration: "10",
    is_active: true,
  });

  const loadData = () => {
    fetch(`/api/kiosk/${id}`)
      .then((r) => r.json())
      .then((data: Presentation) => {
        if (data?.id) {
          setForm({
            name: data.name,
            description: data.description ?? "",
            transition_effect: data.transition_effect ?? "fade",
            transition_time: String(data.transition_time ?? 5),
            display_duration: String(data.display_duration ?? 10),
            is_active: data.is_active !== false,
          });
          setSlides(data.slides ?? []);
        }
      })
      .catch(() => setError("Chyba při načítání"))
      .finally(() => setLoadingData(false));
  };

  useEffect(() => {
    loadData();
  }, [id]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;
    setUploading(true);
    setError("");
    try {
      const formData = new FormData();
      Array.from(files).forEach((f) => formData.append("files", f));
      const res = await fetch(`/api/kiosk/${id}/slides`, { method: "POST", body: formData });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Chyba při nahrávání");
      loadData();
      router.refresh();
      e.target.value = "";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Chyba při nahrávání");
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteSlide = async (slideId: number) => {
    if (!confirm("Opravdu smazat tento snímek?")) return;
    setError("");
    try {
      const res = await fetch(`/api/kiosk/slides/${slideId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Chyba při mazání");
      setSlides((s) => s.filter((x) => x.id !== slideId));
      router.refresh();
    } catch {
      setError("Chyba při mazání snímku");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch(`/api/kiosk/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          transition_time: parseInt(form.transition_time, 10) || 5,
          display_duration: parseInt(form.display_duration, 10) || 10,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data.error ?? "Chyba při ukládání");
        setLoading(false);
        return;
      }

      router.push(`/kiosk/${id}`);
      router.refresh();
    } catch {
      setError("Chyba při ukládání");
      setLoading(false);
    }
  };

  if (loadingData) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-8 text-center">
        <p className="text-gray-500">Načítání…</p>
      </div>
    );
  }

  return (
    <>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Upravit prezentaci</h1>
          <p className="mt-1 text-gray-600">{form.name || "Prezentace"}</p>
        </div>
        <Link
          href={`/kiosk/${id}`}
          className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50"
        >
          <ArrowLeft className="h-4 w-4" />
          Zpět
        </Link>
      </div>

      <form onSubmit={handleSubmit} className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        {error && (
          <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="mb-1 block text-sm font-medium text-gray-700">Název *</label>
            <input
              type="text"
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full rounded-lg border border-gray-300 px-3 py-2"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Přechod</label>
            <select
              value={form.transition_effect}
              onChange={(e) => setForm({ ...form, transition_effect: e.target.value })}
              className="w-full rounded-lg border border-gray-300 px-3 py-2"
            >
              <option value="fade">Fade</option>
              <option value="slide">Slide</option>
              <option value="zoom">Zoom</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Čas přechodu (s)</label>
            <input
              type="number"
              min={1}
              max={30}
              value={form.transition_time}
              onChange={(e) => setForm({ ...form, transition_time: e.target.value })}
              className="w-full rounded-lg border border-gray-300 px-3 py-2"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Délka zobrazení (s)</label>
            <input
              type="number"
              min={1}
              max={120}
              value={form.display_duration}
              onChange={(e) => setForm({ ...form, display_duration: e.target.value })}
              className="w-full rounded-lg border border-gray-300 px-3 py-2"
            />
          </div>
          <div className="flex items-center gap-2 sm:col-span-2">
            <input
              type="checkbox"
              id="is_active"
              checked={form.is_active}
              onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
              className="rounded"
            />
            <label htmlFor="is_active" className="text-sm text-gray-700">Aktivní</label>
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-sm font-medium text-gray-700">Popis</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={3}
              className="w-full rounded-lg border border-gray-300 px-3 py-2"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="mb-2 block text-sm font-medium text-gray-700">Snímky</label>
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept="image/jpeg,image/png,image/jpg,application/pdf"
                  onChange={handleUpload}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  <Upload className="h-4 w-4" />
                  {uploading ? "Nahrávám…" : "Přidat snímky"}
                </button>
              </div>
              {slides.length > 0 ? (
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {slides.map((slide) => (
                    <div
                      key={slide.id}
                      className="flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 p-2"
                    >
                      <div className="h-12 w-12 shrink-0 overflow-hidden rounded bg-gray-200">
                        {slide.file_type === "image" ? (
                          <img
                            src={slide.file_path}
                            alt=""
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center">
                            <Image className="h-6 w-6 text-gray-400" />
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-gray-900">
                          {slide.title || slide.filename}
                        </p>
                        <p className="truncate text-xs text-gray-500">{slide.filename}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDeleteSlide(slide.id)}
                        className="rounded p-1.5 text-red-600 hover:bg-red-50"
                        title="Smazat"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500">Žádné snímky. Klikněte na „Přidat snímky“.</p>
              )}
            </div>
          </div>
        </div>

        <div className="mt-6 flex gap-2">
          <button
            type="submit"
            disabled={loading}
            className="rounded-lg bg-red-600 px-4 py-2 font-medium text-white hover:bg-red-700 disabled:opacity-50"
          >
            {loading ? "Ukládám…" : "Uložit"}
          </button>
          <Link
            href={`/kiosk/${id}`}
            className="rounded-lg border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50"
          >
            Zrušit
          </Link>
        </div>
      </form>
    </>
  );
}
