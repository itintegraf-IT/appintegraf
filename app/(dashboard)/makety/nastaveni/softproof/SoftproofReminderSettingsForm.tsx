"use client";

import { useEffect, useState } from "react";

type Settings = {
  enabled: boolean;
  default_on_send: boolean;
  notify_prohlizec: boolean;
};

export function SoftproofReminderSettingsForm() {
  const [settings, setSettings] = useState<Settings>({
    enabled: false,
    default_on_send: true,
    notify_prohlizec: false,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    void (async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/makety/softproof-reminder-settings");
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error ?? "Načtení selhalo");
        setSettings({
          enabled: data.settings?.enabled === true,
          default_on_send: data.settings?.default_on_send !== false,
          notify_prohlizec: data.settings?.notify_prohlizec === true,
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
      const res = await fetch("/api/makety/softproof-reminder-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Uložení selhalo");
      setSettings({
        enabled: data.settings?.enabled === true,
        default_on_send: data.settings?.default_on_send !== false,
        notify_prohlizec: data.settings?.notify_prohlizec === true,
      });
      setNotice("Nastavení softproofu uloženo.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Chyba");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <p className="text-sm text-gray-500">Načítám nastavení připomínek…</p>;
  }

  return (
    <div className="mb-8 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <h3 className="text-base font-semibold text-gray-900">Automatické připomínky</h3>
      <p className="mt-1 text-sm text-gray-600">
        Po vypršení 7denního softproof odkazu (klient neschválil) denní cron pošle nový odkaz
        e-mailem. Endpoint:{" "}
        <code className="text-xs">POST /api/cron/makety-softproof-reminders</code>
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
            Zapnout automatické připomínky
            <span className="mt-0.5 block text-xs font-normal text-gray-500">
              Bez tohoto přepínače cron připomínky neodesílá a checkbox u odeslání se nezobrazí.
            </span>
          </span>
        </label>

        <label className="flex items-start gap-2 text-sm text-gray-800">
          <input
            type="checkbox"
            className="mt-0.5"
            checked={settings.default_on_send}
            onChange={(e) =>
              setSettings((s) => ({ ...s, default_on_send: e.target.checked }))
            }
            disabled={saving || !settings.enabled}
          />
          <span>
            Výchozí zapnutí při odeslání softproofu
            <span className="mt-0.5 block text-xs font-normal text-gray-500">
              Předvyplní checkbox v dialogu; u konkrétního odeslání lze vypnout.
            </span>
          </span>
        </label>
      </div>

      <h3 className="mt-8 text-base font-semibold text-gray-900">Prohlížeči klienta</h3>
      <p className="mt-1 text-sm text-gray-600">
        Volitelná notifikace uživatelům s rolí Prohlížeč klienta přiřazeným ke stejnému IML
        klientovi jako grafika.
      </p>

      <div className="mt-4 space-y-3">
        <label className="flex items-start gap-2 text-sm text-gray-800">
          <input
            type="checkbox"
            className="mt-0.5"
            checked={settings.notify_prohlizec}
            onChange={(e) =>
              setSettings((s) => ({ ...s, notify_prohlizec: e.target.checked }))
            }
            disabled={saving}
          />
          <span>
            Notifikovat prohlížeče klienta při odeslání softproofu
            <span className="mt-0.5 block text-xs font-normal text-gray-500">
              In-app a e-mail (dle preference modulu Makety) s odkazem na zakázku v aplikaci.
            </span>
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
