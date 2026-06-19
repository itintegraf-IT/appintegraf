"use client";

import { useEffect, useState } from "react";

export function StitkySettingsForm({ initialRecipients }: { initialRecipients: string }) {
  const [recipients, setRecipients] = useState(initialRecipients);
  const [msg, setMsg] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setRecipients(initialRecipients);
  }, [initialRecipients]);

  const save = async () => {
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch("/api/stitky/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email_recipients: recipients }),
      });
      if (res.ok) setMsg("Uloženo");
      else setMsg("Uložení selhalo");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-xl space-y-6">
      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <h2 className="mb-2 text-lg font-semibold text-gray-900">Příjemci notifikací</h2>
        <p className="mb-4 text-sm text-gray-600">
          Hlavní příjemce se odvozují z rolí v{" "}
          <strong>administraci uživatelů</strong> (Tiskař, Mistr, Admin modulu). Zde lze doplnit
          dodatečné e-mailové adresy bez účtu v systému.
        </p>
        <ul className="mb-4 list-inside list-disc text-sm text-gray-600">
          <li>
            <strong>Zadání pro mailing</strong> — in-app + e-mail: tiskaři a admin modulu
          </li>
          <li>
            <strong>Zadání pro mistry</strong> — in-app: mistři (bez e-mailu)
          </li>
          <li>
            <strong>Hotovo / vytištěno</strong> — in-app zadavateli zakázky; e-mail při Hotovo stejným
            kanálem jako mailing
          </li>
        </ul>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <h3 className="mb-1 text-sm font-semibold text-gray-900">Dodatečné e-mailové adresy</h3>
        <label className="mb-1 block text-sm text-gray-600">
          Oddělené středníkem nebo čárkou (volitelné)
        </label>
        <textarea
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
          rows={3}
          value={recipients}
          onChange={(e) => setRecipients(e.target.value)}
          placeholder="operator@integraf.cz"
        />
        {msg && <p className="mt-3 text-sm text-green-700">{msg}</p>}
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="mt-4 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
        >
          {saving ? "Ukládám…" : "Uložit"}
        </button>
      </div>
    </div>
  );
}
