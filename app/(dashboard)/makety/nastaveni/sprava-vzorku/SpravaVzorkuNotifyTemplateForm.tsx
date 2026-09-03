"use client";

import { useEffect, useState } from "react";
import type { SpravaVzorkuNotifyTemplate } from "@/lib/makety-sprava-vzorku-template";
import {
  DEFAULT_SPRAVA_VZORKU_NOTIFY_TEMPLATE,
  SPRAVA_VZORKU_PLACEHOLDER_HINT,
} from "@/lib/makety-sprava-vzorku-template";

const FIELDS: Array<{ key: keyof SpravaVzorkuNotifyTemplate; label: string; rows?: number }> = [
  { key: "subject", label: "Předmět e-mailu" },
  { key: "title", label: "Titulek in-app notifikace" },
  { key: "intro", label: "Text zprávy (e-mail + notifikace)", rows: 4 },
  { key: "ctaLabel", label: "Text tlačítka v e-mailu" },
];

export function SpravaVzorkuNotifyTemplateForm() {
  const [template, setTemplate] = useState<SpravaVzorkuNotifyTemplate>({
    ...DEFAULT_SPRAVA_VZORKU_NOTIFY_TEMPLATE,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/admin/makety-sprava-vzorku-template")
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        if (data.template && typeof data.template === "object") {
          setTemplate({ ...DEFAULT_SPRAVA_VZORKU_NOTIFY_TEMPLATE, ...data.template });
        }
      })
      .catch(() => {
        if (!cancelled) setMessage({ type: "err", text: "Chyba při načítání šablony" });
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const save = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/makety-sprava-vzorku-template", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ template }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage({
          type: "err",
          text: typeof data.error === "string" ? data.error : "Uložení selhalo",
        });
        return;
      }
      if (data.template && typeof data.template === "object") {
        setTemplate(data.template);
      }
      setMessage({ type: "ok", text: "Šablona uložena" });
    } catch {
      setMessage({ type: "err", text: "Síťová chyba" });
    } finally {
      setSaving(false);
    }
  };

  const resetDefaults = () => {
    setTemplate({ ...DEFAULT_SPRAVA_VZORKU_NOTIFY_TEMPLATE });
    setMessage(null);
  };

  if (loading) {
    return <p className="text-sm text-gray-500">Načítám šablonu…</p>;
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600">
        Notifikace se odesílá uživatelům s rolí Správa vzorků při zadání grafiky s typem dat
        „úprava dat“. Placeholdery:{" "}
        <code className="rounded bg-gray-100 px-1 text-xs">{SPRAVA_VZORKU_PLACEHOLDER_HINT}</code>
      </p>

      {FIELDS.map((field) => (
        <label key={field.key} className="block">
          <span className="mb-1 block text-sm font-medium text-gray-700">{field.label}</span>
          {field.rows ? (
            <textarea
              rows={field.rows}
              value={template[field.key]}
              onChange={(e) => setTemplate((prev) => ({ ...prev, [field.key]: e.target.value }))}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          ) : (
            <input
              type="text"
              value={template[field.key]}
              onChange={(e) => setTemplate((prev) => ({ ...prev, [field.key]: e.target.value }))}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          )}
        </label>
      ))}

      {message && (
        <p
          className={`text-sm ${message.type === "ok" ? "text-green-700" : "text-red-600"}`}
          role="status"
        >
          {message.text}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => void save()}
          disabled={saving}
          className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-60"
        >
          {saving ? "Ukládám…" : "Uložit"}
        </button>
        <button
          type="button"
          onClick={resetDefaults}
          disabled={saving}
          className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-60"
        >
          Obnovit výchozí
        </button>
      </div>
    </div>
  );
}
