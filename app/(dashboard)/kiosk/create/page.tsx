"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Upload } from "lucide-react";

export default function CreateKioskPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    name: "",
    description: "",
    transition_effect: "fade",
    transition_time: "5",
    display_duration: "10",
  });
  const [files, setFiles] = useState<File[]>([]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const formData = new FormData();
      formData.append("name", form.name);
      formData.append("description", form.description);
      formData.append("transition_effect", form.transition_effect);
      formData.append("transition_time", form.transition_time);
      formData.append("display_duration", form.display_duration);
      files.forEach((f) => formData.append("files", f));

      const res = await fetch("/api/kiosk", {
        method: "POST",
        body: formData,
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data.error ?? "Chyba při ukládání");
        setLoading(false);
        return;
      }

      router.push(`/kiosk/${data.id}`);
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
          <h1 className="text-2xl font-bold text-gray-900">Nová prezentace</h1>
          <p className="mt-1 text-gray-600">Vytvořit prezentaci pro Kiosk monitory</p>
        </div>
        <Link
          href="/kiosk"
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
            <label className="mb-1 block text-sm font-medium text-gray-700">
              <Upload className="mr-1 inline h-4 w-4" />
              Nahrát snímky (JPG, PNG, PDF)
            </label>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/jpeg,image/png,image/jpg,application/pdf"
              onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 file:mr-2 file:rounded file:border-0 file:bg-red-50 file:px-3 file:py-1 file:text-sm file:font-medium file:text-red-600"
            />
            <p className="mt-1 text-xs text-gray-500">
              Můžete nahrát více souborů najednou. Max 10 MB na soubor.
            </p>
            {files.length > 0 && (
              <p className="mt-1 text-sm text-gray-600">Vybráno: {files.length} souborů</p>
            )}
          </div>
        </div>

        <div className="mt-6 flex gap-2">
          <button
            type="submit"
            disabled={loading}
            className="rounded-lg bg-red-600 px-4 py-2 font-medium text-white hover:bg-red-700 disabled:opacity-50"
          >
            {loading ? "Ukládám…" : "Vytvořit"}
          </button>
          <Link
            href="/kiosk"
            className="rounded-lg border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50"
          >
            Zrušit
          </Link>
        </div>
      </form>
    </>
  );
}
