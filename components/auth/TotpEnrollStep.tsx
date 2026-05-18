"use client";

import { useState, useEffect } from "react";
import { TotpCodeInput } from "@/components/auth/TotpCodeInput";
import { Copy, Check } from "lucide-react";

type TotpEnrollStepProps = {
  loginChallenge: string;
  onComplete: (totpCode: string) => void;
  onBack: () => void;
  loading: boolean;
  error: string;
};

export function TotpEnrollStep({
  loginChallenge,
  onComplete,
  onBack,
  loading,
  error,
}: TotpEnrollStepProps) {
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [qrLoading, setQrLoading] = useState(true);
  const [qrError, setQrError] = useState("");
  const [code, setCode] = useState("");
  const [backupCodes, setBackupCodes] = useState<string[] | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [confirmError, setConfirmError] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setQrLoading(true);
    setQrError("");
    fetch("/api/auth/totp/enroll", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ loginChallenge }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        if (!data.qrDataUrl) {
          setQrError(data.error ?? "Nepodařilo se načíst QR kód.");
          return;
        }
        setQrDataUrl(data.qrDataUrl);
      })
      .catch(() => {
        if (!cancelled) setQrError("Chyba při načítání QR kódu.");
      })
      .finally(() => {
        if (!cancelled) setQrLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [loginChallenge]);

  const handleConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    setConfirmError("");
    setConfirming(true);
    try {
      const res = await fetch("/api/auth/totp/confirm-enrollment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ loginChallenge, code }),
      });
      const data = await res.json();
      if (!res.ok) {
        setConfirmError(data.error ?? "Neplatný kód.");
        return;
      }
      setBackupCodes(data.backupCodes ?? []);
    } catch {
      setConfirmError("Chyba při aktivaci 2FA.");
    } finally {
      setConfirming(false);
    }
  };

  const displayError = error || confirmError || qrError;

  if (backupCodes && backupCodes.length > 0) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <p style={{ fontSize: 13, color: "var(--text-muted)", margin: 0 }}>
          2FA je aktivní. Uložte si záložní kódy – zobrazí se jen jednou.
        </p>
        <ul
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 6,
            fontFamily: "monospace",
            fontSize: 13,
            margin: 0,
            padding: 12,
            background: "var(--surface-2)",
            borderRadius: 10,
            border: "1px solid var(--border)",
          }}
        >
          {backupCodes.map((c) => (
            <li key={c} style={{ listStyle: "none" }}>
              {c}
            </li>
          ))}
        </ul>
        <button
          type="button"
          onClick={async () => {
            await navigator.clipboard.writeText(backupCodes.join("\n"));
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          }}
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
            fontSize: 12,
            padding: "8px 12px",
            borderRadius: 8,
            border: "1px solid var(--border)",
            background: "var(--surface-2)",
            cursor: "pointer",
            color: "var(--text)",
          }}
        >
          {copied ? <Check size={14} /> : <Copy size={14} />}
          {copied ? "Zkopírováno" : "Kopírovat kódy"}
        </button>
        <button
          type="button"
          disabled={loading}
          onClick={() => onComplete(code)}
          style={{
            marginTop: 8,
            width: "100%",
            height: 42,
            borderRadius: 10,
            background: "#FFE600",
            border: "none",
            cursor: loading ? "default" : "pointer",
            color: "var(--bg)",
            fontSize: 14,
            fontWeight: 700,
            opacity: loading ? 0.7 : 1,
          }}
        >
          {loading ? "Přihlašování…" : "Pokračovat do aplikace"}
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleConfirm} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <p style={{ fontSize: 13, color: "var(--text-muted)", margin: 0 }}>
        Naskenujte QR kód v aplikaci Google Authenticator (nebo jiné TOTP aplikaci) a zadejte
        ověřovací kód.
      </p>

      {qrLoading ? (
        <p style={{ fontSize: 13, color: "var(--text-muted)", textAlign: "center" }}>Načítám QR…</p>
      ) : qrDataUrl ? (
        <div style={{ display: "flex", justifyContent: "center" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qrDataUrl} alt="QR kód pro 2FA" width={220} height={220} />
        </div>
      ) : null}

      <div>
        <label
          htmlFor="enroll-totp"
          style={{
            fontSize: 10,
            fontWeight: 600,
            color: "var(--text-muted)",
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            display: "block",
            marginBottom: 6,
          }}
        >
          Ověřovací kód
        </label>
        <TotpCodeInput
          id="enroll-totp"
          value={code}
          onChange={setCode}
          disabled={confirming || loading}
          autoFocus
        />
      </div>

      {displayError && (
        <div
          style={{
            fontSize: 11,
            color: "var(--danger)",
            background: "color-mix(in oklab, var(--danger) 12%, transparent)",
            border: "1px solid color-mix(in oklab, var(--danger) 28%, transparent)",
            borderRadius: 8,
            padding: "8px 12px",
          }}
        >
          {displayError}
        </div>
      )}

      <button
        type="submit"
        disabled={confirming || loading || code.length !== 6 || !qrDataUrl}
        style={{
          marginTop: 8,
          width: "100%",
          height: 42,
          borderRadius: 10,
          background: "#FFE600",
          border: "none",
          cursor: confirming || loading ? "default" : "pointer",
          color: "var(--bg)",
          fontSize: 14,
          fontWeight: 700,
          opacity: confirming || loading ? 0.7 : 1,
        }}
      >
        {confirming ? "Ověřování…" : "Aktivovat 2FA a pokračovat"}
      </button>

      <button
        type="button"
        onClick={onBack}
        style={{
          background: "none",
          border: "none",
          color: "var(--text-muted)",
          fontSize: 12,
          cursor: "pointer",
          padding: 0,
        }}
      >
        ← Zpět na přihlášení
      </button>
    </form>
  );
}
