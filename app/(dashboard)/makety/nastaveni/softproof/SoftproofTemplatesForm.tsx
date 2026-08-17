"use client";

import { useEffect, useState } from "react";
import type { SoftproofTemplate } from "@/lib/makety-softproof-templates";
import { DEFAULT_SOFTPROOF_TEMPLATES } from "@/lib/makety-softproof-templates";

const FIELDS: Array<{ key: keyof SoftproofTemplate; label: string; rows?: number }> = [
  { key: "subject", label: "Předmět e-mailu" },
  { key: "greeting", label: "Oslovení" },
  { key: "intro", label: "Úvodní věta" },
  { key: "legalHtml", label: "Právní / kontrolní text (modrý box)", rows: 8 },
  { key: "ctaLabel", label: "Text tlačítka v e-mailu" },
  { key: "validityNote", label: "Poznámka k platnosti odkazu", rows: 3 },
  { key: "footer", label: "Patička e-mailu" },
  { key: "pageTitle", label: "Nadpis veřejné stránky" },
  { key: "pageHint", label: "Nápověda na stránce", rows: 3 },
  { key: "downloadLabel", label: "Tlačítko stažení" },
  { key: "approveLabel", label: "Tlačítko Schválit" },
  { key: "rejectLabel", label: "Tlačítko Zamítnout" },
  { key: "rejectReasonLabel", label: "Popisek důvodu zamítnutí" },
  { key: "usedMessage", label: "Text po použití odkazu", rows: 3 },
  { key: "expiredMessage", label: "Text po vypršení odkazu", rows: 3 },
];

export function SoftproofTemplatesForm() {
  const [templates, setTemplates] = useState<SoftproofTemplate[]>([]);
  const [activeLocale, setActiveLocale] = useState("cs");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [newLocale, setNewLocale] = useState("");
  const [newLabel, setNewLabel] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetch("/api/admin/softproof-templates")
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        const list = Array.isArray(data.templates) ? (data.templates as SoftproofTemplate[]) : [];
        setTemplates(list.length ? list : DEFAULT_SOFTPROOF_TEMPLATES.map((t) => ({ ...t })));
        setActiveLocale(list[0]?.locale ?? "cs");
      })
      .catch(() => {
        if (!cancelled) setMessage({ type: "err", text: "Chyba při načítání šablon" });
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const current = templates.find((t) => t.locale === activeLocale) ?? templates[0];

  const patch = (partial: Partial<SoftproofTemplate>) => {
    setTemplates((prev) =>
      prev.map((t) => (t.locale === current?.locale ? { ...t, ...partial } : t))
    );
  };

  const addLocale = () => {
    const locale = newLocale.trim().toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 8);
    const label = newLabel.trim();
    if (!locale || !label) {
      setMessage({ type: "err", text: "Vyplňte kód jazyka i název" });
      return;
    }
    if (templates.some((t) => t.locale === locale)) {
      setMessage({ type: "err", text: "Tento jazyk už existuje" });
      return;
    }
    const base = templates.find((t) => t.locale === "cs") ?? DEFAULT_SOFTPROOF_TEMPLATES[0]!;
    setTemplates((prev) => [...prev, { ...base, locale, label, isActive: true }]);
    setActiveLocale(locale);
    setNewLocale("");
    setNewLabel("");
    setMessage(null);
  };

  const save = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/softproof-templates", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ templates }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage({ type: "err", text: typeof data.error === "string" ? data.error : "Uložení selhalo" });
        return;
      }
      if (Array.isArray(data.templates)) setTemplates(data.templates);
      setMessage({ type: "ok", text: "Šablony uloženy" });
    } catch {
      setMessage({ type: "err", text: "Síťová chyba" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <p className="text-sm text-gray-500">Načítám šablony…</p>;
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <p className="mb-4 text-sm text-gray-600">
        Placeholdery: <code>{"{{toName}}"}</code>, <code>{"{{orderNumber}}"}</code>,{" "}
        <code>{"{{labelCode}}"}</code>, <code>{"{{fileName}}"}</code>, <code>{"{{pageUrl}}"}</code>,{" "}
        <code>{"{{maketaId}}"}</code>
      </p>

      <div className="mb-4 flex flex-wrap gap-2">
        {templates.map((t) => (
          <button
            key={t.locale}
            type="button"
            onClick={() => setActiveLocale(t.locale)}
            className={`rounded-lg border px-3 py-1.5 text-sm ${
              t.locale === current?.locale
                ? "border-violet-600 bg-violet-50 font-medium text-violet-800"
                : "border-gray-200 text-gray-700 hover:bg-gray-50"
            }`}
          >
            {t.label} ({t.locale})
            {!t.isActive ? " – vypnuto" : ""}
          </button>
        ))}
      </div>

      {current && (
        <div className="space-y-3">
          <label className="block text-sm font-medium text-gray-700">
            Název jazyka
            <input
              className="mt-1 w-full max-w-sm rounded-lg border border-gray-300 px-3 py-2 text-sm"
              value={current.label}
              onChange={(e) => patch({ label: e.target.value })}
            />
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={current.isActive}
              onChange={(e) => patch({ isActive: e.target.checked })}
            />
            Aktivní (nabízí se při odeslání)
          </label>
          {FIELDS.map((f) => (
            <label key={f.key} className="block text-sm font-medium text-gray-700">
              {f.label}
              {f.rows ? (
                <textarea
                  rows={f.rows}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  value={String(current[f.key] ?? "")}
                  onChange={(e) => patch({ [f.key]: e.target.value })}
                />
              ) : (
                <input
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  value={String(current[f.key] ?? "")}
                  onChange={(e) => patch({ [f.key]: e.target.value })}
                />
              )}
            </label>
          ))}
        </div>
      )}

      <div className="mt-6 rounded-lg border border-dashed border-gray-300 p-3">
        <p className="mb-2 text-sm font-medium text-gray-700">Přidat jazyk</p>
        <div className="flex flex-wrap items-end gap-2">
          <label className="text-xs text-gray-600">
            Kód
            <input
              className="mt-1 block w-24 rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
              placeholder="pl"
              value={newLocale}
              onChange={(e) => setNewLocale(e.target.value)}
            />
          </label>
          <label className="text-xs text-gray-600">
            Název
            <input
              className="mt-1 block w-40 rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
              placeholder="Polski"
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
            />
          </label>
          <button
            type="button"
            onClick={addLocale}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
          >
            Přidat
          </button>
        </div>
      </div>

      {message && (
        <p className={`mt-4 text-sm ${message.type === "ok" ? "text-green-700" : "text-red-600"}`}>
          {message.text}
        </p>
      )}

      <div className="mt-4">
        <button
          type="button"
          onClick={() => void save()}
          disabled={saving}
          className="rounded-lg bg-violet-700 px-4 py-2 text-sm font-medium text-white hover:bg-violet-800 disabled:opacity-50"
        >
          {saving ? "Ukládám…" : "Uložit šablony"}
        </button>
      </div>
    </div>
  );
}
