"use client";

import { useState, useEffect } from "react";

type EmailSettings = {
  enabled: boolean;
  host: string;
  port: number;
  secure: boolean;
  user: string;
  password: string;
  from: string;
  fromName: string;
  passwordSet: boolean;
};

export function EmailSettingsForm() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sendingTest, setSendingTest] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [form, setForm] = useState<EmailSettings>({
    enabled: false,
    host: "smtp.office365.com",
    port: 587,
    secure: false,
    user: "",
    password: "",
    from: "",
    fromName: "INTEGRAF",
    passwordSet: false,
  });

  useEffect(() => {
    let cancelled = false;
    fetch("/api/admin/email-settings")
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        if (data.enabled !== undefined) {
          setForm({
            enabled: data.enabled,
            host: data.host ?? "smtp.office365.com",
            port: data.port ?? 587,
            secure: data.secure ?? false,
            user: data.user ?? "",
            password: "",
            from: data.from ?? "",
            fromName: data.fromName ?? "INTEGRAF",
            passwordSet: data.passwordSet ?? false,
          });
        }
      })
      .catch(() => {
        if (!cancelled) setMessage({ type: "err", text: "Chyba při načítání nastavení" });
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/email-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enabled: form.enabled,
          host: form.host,
          port: form.port,
          secure: form.secure,
          user: form.user,
          password: form.password || undefined,
          from: form.from,
          fromName: form.fromName,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? "Chyba při ukládání");
      }
      setMessage({ type: "ok", text: "Nastavení bylo uloženo." });
      setForm((prev) => ({ ...prev, password: "", passwordSet: prev.password ? true : prev.passwordSet }));
    } catch (err) {
      setMessage({
        type: "err",
        text: err instanceof Error ? err.message : "Chyba při ukládání",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleSendTest = async () => {
    setSendingTest(true);
    setMessage(null);
    try {
      const body: { settingsOverride?: Record<string, unknown> } = {
        settingsOverride: {
          host: form.host,
          port: form.port,
          secure: form.secure,
          user: form.user,
          from: form.from,
          fromName: form.fromName,
        },
      };
      if (form.password) body.settingsOverride!.password = form.password;
      const res = await fetch("/api/admin/email-settings/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? "Chyba při odesílání");
      }
      setMessage({ type: "ok", text: "Testovací e-mail byl odeslán na váš e-mail." });
    } catch (err) {
      setMessage({
        type: "err",
        text: err instanceof Error ? err.message : "Chyba při odesílání testu",
      });
    } finally {
      setSendingTest(false);
    }
  };

  if (loading) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-8 text-center text-gray-500">
        Načítání…
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm"
    >
      {message && (
        <div
          className={`mb-4 rounded-lg px-4 py-2 ${
            message.type === "ok" ? "bg-green-50 text-green-800" : "bg-red-50 text-red-800"
          }`}
        >
          {message.text}
        </div>
      )}

      <div className="mb-6 flex items-center gap-2">
        <input
          type="checkbox"
          id="enabled"
          checked={form.enabled}
          onChange={(e) => setForm((p) => ({ ...p, enabled: e.target.checked }))}
          className="h-4 w-4 rounded border-gray-300"
        />
        <label htmlFor="enabled" className="font-medium text-gray-700">
          Povolit odesílání e-mailů (notifikace kalendáře)
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="host" className="mb-1 block text-sm font-medium text-gray-700">
            SMTP host
          </label>
          <input
            id="host"
            type="text"
            value={form.host}
            onChange={(e) => setForm((p) => ({ ...p, host: e.target.value }))}
            placeholder="smtp.office365.com"
            className="w-full rounded-lg border border-gray-300 px-3 py-2"
          />
        </div>
        <div>
          <label htmlFor="port" className="mb-1 block text-sm font-medium text-gray-700">
            Port
          </label>
          <input
            id="port"
            type="number"
            value={form.port}
            onChange={(e) => setForm((p) => ({ ...p, port: parseInt(e.target.value, 10) || 587 }))}
            className="w-full rounded-lg border border-gray-300 px-3 py-2"
          />
          <p className="mt-1 text-xs text-gray-500">Office 365: 587 (STARTTLS)</p>
        </div>
      </div>

      <div className="mt-4 flex items-center gap-2">
        <input
          type="checkbox"
          id="secure"
          checked={form.secure}
          onChange={(e) => setForm((p) => ({ ...p, secure: e.target.checked }))}
          className="h-4 w-4 rounded border-gray-300"
        />
        <label htmlFor="secure" className="text-sm text-gray-700">
          Secure (SSL/TLS) – u Office 365 ponechte vypnuto
        </label>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="user" className="mb-1 block text-sm font-medium text-gray-700">
            SMTP uživatel (e-mail)
          </label>
          <input
            id="user"
            type="email"
            value={form.user}
            onChange={(e) => setForm((p) => ({ ...p, user: e.target.value }))}
            placeholder="noreply@firma.cz"
            className="w-full rounded-lg border border-gray-300 px-3 py-2"
          />
        </div>
        <div>
          <label htmlFor="password" className="mb-1 block text-sm font-medium text-gray-700">
            Heslo
          </label>
          <input
            id="password"
            type="password"
            value={form.password}
            onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
            placeholder={form.passwordSet ? "••••••••" : "Zadejte heslo"}
            className="w-full rounded-lg border border-gray-300 px-3 py-2"
          />
          {form.passwordSet && !form.password && (
            <p className="mt-1 text-xs text-gray-500">Heslo je uloženo. Pro změnu zadejte nové.</p>
          )}
        </div>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="from" className="mb-1 block text-sm font-medium text-gray-700">
            Odesílatel (e-mail)
          </label>
          <input
            id="from"
            type="email"
            value={form.from}
            onChange={(e) => setForm((p) => ({ ...p, from: e.target.value }))}
            placeholder="noreply@firma.cz"
            className="w-full rounded-lg border border-gray-300 px-3 py-2"
          />
        </div>
        <div>
          <label htmlFor="fromName" className="mb-1 block text-sm font-medium text-gray-700">
            Jméno odesílatele
          </label>
          <input
            id="fromName"
            type="text"
            value={form.fromName}
            onChange={(e) => setForm((p) => ({ ...p, fromName: e.target.value }))}
            placeholder="INTEGRAF"
            className="w-full rounded-lg border border-gray-300 px-3 py-2"
          />
        </div>
      </div>

      <div className="mt-6 rounded-lg bg-amber-50 p-4 text-sm text-amber-800">
        <strong>Office 365:</strong> Použijte účet s povoleným SMTP. Při MFA vytvořte v Microsoft účtu
        heslo aplikace a použijte ho místo běžného hesla.
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-red-600 px-6 py-2 font-medium text-white hover:bg-red-700 disabled:opacity-50"
        >
          {saving ? "Ukládám…" : "Uložit nastavení"}
        </button>
        <button
          type="button"
          onClick={handleSendTest}
          disabled={sendingTest}
          className="rounded-lg border border-gray-300 bg-white px-6 py-2 font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >
          {sendingTest ? "Odesílám…" : "Odeslat testovací e-mail"}
        </button>
      </div>
    </form>
  );
}
