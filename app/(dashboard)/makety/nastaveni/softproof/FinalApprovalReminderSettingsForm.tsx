"use client";

import { useEffect, useState } from "react";

type Settings = {
  enabled: boolean;
  interval_hours: number;
};

export function FinalApprovalReminderSettingsForm() {
  const [settings, setSettings] = useState<Settings>({
    enabled: true,
    interval_hours: 24,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    void (async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/makety/final-approval-reminder-settings");
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error ?? "Načtení selhalo");
        setSettings({
          enabled: data.settings?.enabled !== false,
          interval_hours:
            typeof data.settings?.interval_hours === "number"
              ? data.settings.interval_hours
              : 24,
        });
      } catch (e) {
        setError(e instanceof Error ? e.message : "Chyba");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function save() {
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const res = await fetch("/api/makety/final-approval-reminder-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Uložení selhalo");
      setSettings({
        enabled: data.settings?.enabled !== false,
        interval_hours:
          typeof data.settings?.interval_hours === "number"
            ? data.settings.interval_hours
            : 24,
      });
      setNotice("Nastavení připomínek finálního schválení uloženo.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Chyba");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <p className="mb-8 text-sm text-gray-500">Načítám nastavení finálního schválení…</p>;
  }

  return (
    <div className="mb-8 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <h3 className="text-base font-semibold text-gray-900">
        Připomínky finálního schválení
      </h3>
      <p className="mt-1 text-sm text-gray-600">
        Po schválení softproofu klientem zůstává grafika ve stavu „odesláno ke schválení“. Cron
        připomene zadavateli a finálnímu schvalovateli (in-app, e-mail dle matice), dokud není
        finále. Endpoint:{" "}
        <code className="text-xs">POST /api/cron/makety-final-approval-reminders</code>
      </p>

      {error && (
        <p className="mt-3 text-sm text-red-600" role="alert">
          {error}
        </p>
      )}
      {notice && <p className="mt-3 text-sm text-green-700">{notice}</p>}

      <div className="mt-4 space-y-3">
        <label className="flex items-start gap-2 text-sm text-gray-800">
          <input
            type="checkbox"
            className="mt-0.5"
            checked={settings.enabled}
            onChange={(e) =>
              setSettings((s) => ({ ...s, enabled: e.target.checked }))
            }
            disabled={saving}
          />
          <span>
            Zapnout připomínky finálního schválení
            <span className="mt-0.5 block text-xs font-normal text-gray-500">
              Výchozí zapnuto. Bez přepínače cron připomínky neodesílá.
            </span>
          </span>
        </label>

        <label className="block text-sm text-gray-800">
          Interval (hodiny)
          <input
            type="number"
            min={1}
            max={168}
            className="mt-1 w-28 rounded-lg border border-gray-300 px-3 py-2 text-sm"
            value={settings.interval_hours}
            onChange={(e) =>
              setSettings((s) => ({
                ...s,
                interval_hours: Math.max(1, parseInt(e.target.value, 10) || 24),
              }))
            }
            disabled={saving || !settings.enabled}
          />
          <span className="mt-0.5 block text-xs font-normal text-gray-500">
            Od client approve nebo od poslední připomínky (výchozí 24 h).
          </span>
        </label>
      </div>

      <div className="mt-4">
        <button
          type="button"
          onClick={() => void save()}
          disabled={saving}
          className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
        >
          {saving ? "Ukládám…" : "Uložit nastavení"}
        </button>
      </div>
    </div>
  );
}
