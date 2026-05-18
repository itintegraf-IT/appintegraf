"use client";

import { useState, useEffect, useCallback } from "react";
import { Shield, ShieldOff, Clock } from "lucide-react";

type TotpStatus = {
  enabled: boolean;
  required: boolean;
  waitingEnrollment: boolean;
  enabledAt: string | null;
};

type TotpAdminPanelProps = {
  userId: number;
  username: string;
};

export function TotpAdminPanel({ userId, username }: TotpAdminPanelProps) {
  const [status, setStatus] = useState<TotpStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const loadStatus = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/users/${userId}/totp`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Nepodařilo se načíst stav 2FA.");
        return;
      }
      setStatus(data);
    } catch {
      setError("Chyba při načítání stavu 2FA.");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  const handleRequire = async () => {
    setBusy(true);
    setError("");
    setSuccessMsg("");
    try {
      const res = await fetch(`/api/admin/users/${userId}/totp/require`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Nepodařilo se zapnout 2FA.");
        return;
      }
      setSuccessMsg(
        data.message ??
          "2FA zapnuta. Uživatel dokončí nastavení při příštím přihlášení."
      );
      await loadStatus();
    } catch {
      setError("Chyba při zapínání 2FA.");
    } finally {
      setBusy(false);
    }
  };

  const handleDisable = async () => {
    if (
      !confirm(
        `Opravdu vypnout 2FA pro uživatele „${username}"? Uživatel bude odhlášen ze všech zařízení.`
      )
    ) {
      return;
    }
    setBusy(true);
    setError("");
    setSuccessMsg("");
    try {
      const res = await fetch(`/api/admin/users/${userId}/totp/disable`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Nepodařilo se vypnout 2FA.");
        return;
      }
      setSuccessMsg("2FA byla vypnuta.");
      await loadStatus();
    } catch {
      setError("Chyba při vypínání 2FA.");
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="mt-6 rounded-xl border border-gray-200 bg-gray-50 p-6 text-sm text-gray-500">
        Načítám stav 2FA…
      </div>
    );
  }

  const isActive = status?.enabled;
  const isWaiting = status?.waitingEnrollment;

  return (
    <div className="mt-6 rounded-xl border border-gray-200 bg-gray-50 p-6">
      <div className="mb-4 flex items-center gap-2">
        <Shield className="h-5 w-5 text-gray-700" />
        <h3 className="text-lg font-semibold text-gray-900">Dvoufaktorové ověření (2FA)</h3>
      </div>
      <p className="mb-4 text-sm text-gray-600">
        Administrátor pouze zapne nebo vypne 2FA. Po zapnutí si uživatel při příštím přihlášení sám
        naskenuje QR kód v aplikaci Google Authenticator na svém telefonu.
      </p>

      {isActive ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
          <p className="font-medium">2FA je aktivní</p>
          {status?.enabledAt && (
            <p className="mt-1 text-emerald-800">
              Dokončeno: {new Date(status.enabledAt).toLocaleString("cs-CZ")}
            </p>
          )}
          <button
            type="button"
            onClick={handleDisable}
            disabled={busy}
            className="mt-3 inline-flex items-center gap-2 rounded-lg border border-red-300 bg-white px-3 py-2 text-sm text-red-700 hover:bg-red-50 disabled:opacity-50"
          >
            <ShieldOff className="h-4 w-4" />
            Vypnout 2FA
          </button>
        </div>
      ) : isWaiting ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <p className="font-medium flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Čeká na nastavení uživatelem
          </p>
          <p className="mt-1">
            Uživatel dokončí 2FA při příštím přihlášení (zobrazí se mu QR kód).
          </p>
          <button
            type="button"
            onClick={handleDisable}
            disabled={busy}
            className="mt-3 inline-flex items-center gap-2 rounded-lg border border-red-300 bg-white px-3 py-2 text-sm text-red-700 hover:bg-red-50 disabled:opacity-50"
          >
            <ShieldOff className="h-4 w-4" />
            Zrušit požadavek 2FA
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={handleRequire}
          disabled={busy}
          className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          <Shield className="h-4 w-4" />
          Zapnout 2FA
        </button>
      )}

      {successMsg && <p className="mt-3 text-sm text-emerald-700">{successMsg}</p>}
      {error && <p className="mt-3 text-sm text-red-700">{error}</p>}
    </div>
  );
}
