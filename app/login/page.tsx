"use client";

import { signIn } from "next-auth/react";
import { useEffect, useState } from "react";
import Link from "next/link";
import { TotpCodeInput } from "@/components/auth/TotpCodeInput";
import { TotpEnrollStep } from "@/components/auth/TotpEnrollStep";

type LoginStep = "credentials" | "totp_enroll" | "totp" | "backup";

function LoginForm() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [totp, setTotp] = useState("");
  const [backupCode, setBackupCode] = useState("");
  const [step, setStep] = useState<LoginStep>("credentials");
  const [loginChallenge, setLoginChallenge] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [callbackUrl, setCallbackUrl] = useState("/");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const cb = params.get("callbackUrl");
    if (cb) setCallbackUrl(cb);
  }, []);

  async function completeSignIn(
    creds: Record<string, string>
  ): Promise<boolean> {
    const result = await signIn("credentials", {
      ...creds,
      redirect: false,
    });

    if (result?.error) {
      setError(
        step === "credentials"
          ? "Neplatné uživatelské jméno nebo heslo."
          : "Neplatný ověřovací nebo záložní kód."
      );
      return false;
    }

    if (result?.ok) {
      window.location.href = callbackUrl;
      return true;
    }

    setError("Došlo k chybě při přihlášení.");
    return false;
  }

  async function handleCredentialsSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/pre-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(
          data.error ??
            (res.status >= 500
              ? "Chyba serveru při přihlášení. Zkuste obnovit stránku nebo kontaktujte správce."
              : "Neplatné uživatelské jméno nebo heslo.")
        );
        setLoading(false);
        return;
      }

      if (data.next === "totp_enroll" && data.challenge) {
        setLoginChallenge(data.challenge);
        setStep("totp_enroll");
        setLoading(false);
        return;
      }

      if (data.next === "totp" && data.challenge) {
        setLoginChallenge(data.challenge);
        setStep("totp");
        setTotp("");
        setBackupCode("");
        setLoading(false);
        return;
      }

      await completeSignIn({ username, password });
    } catch {
      setError("Došlo k chybě při přihlášení.");
    }
    setLoading(false);
  }

  async function handleTotpSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const creds: Record<string, string> = { loginChallenge };
      if (step === "backup") {
        creds.backupCode = backupCode.trim();
      } else {
        creds.totp = totp;
      }
      await completeSignIn(creds);
    } catch {
      setError("Došlo k chybě při přihlášení.");
    }
    setLoading(false);
  }

  const labelStyle = {
    fontSize: 10,
    fontWeight: 600,
    color: "var(--text-muted)",
    letterSpacing: "0.08em",
    textTransform: "uppercase" as const,
    display: "block",
    marginBottom: 6,
  };

  const inputStyle = {
    width: "100%",
    boxSizing: "border-box" as const,
    height: 40,
    borderRadius: 10,
    background: "var(--surface-2)",
    border: "1px solid var(--border)",
    color: "var(--text)",
    fontSize: 14,
    padding: "0 12px",
    outline: "none",
    transition: "border-color 120ms ease-out",
  };

  if (step === "totp_enroll") {
    return (
      <TotpEnrollStep
        loginChallenge={loginChallenge}
        loading={loading}
        error={error}
        onBack={() => {
          setStep("credentials");
          setLoginChallenge("");
          setError("");
        }}
        onComplete={async (confirmedCode) => {
          setError("");
          setLoading(true);
          const ok = await completeSignIn({
            loginChallenge,
            totp: confirmedCode,
          });
          if (!ok) setLoading(false);
        }}
      />
    );
  }

  if (step === "totp" || step === "backup") {
    return (
      <form
        onSubmit={handleTotpSubmit}
        style={{ display: "flex", flexDirection: "column", gap: 12 }}
      >
        <p style={{ fontSize: 13, color: "var(--text-muted)", margin: 0 }}>
          {step === "backup"
            ? "Zadejte jednorázový záložní kód."
            : "Zadejte 6místný kód z aplikace Google Authenticator."}
        </p>

        {step === "totp" ? (
          <div>
            <label htmlFor="totp" style={labelStyle}>
              Ověřovací kód
            </label>
            <TotpCodeInput
              id="totp"
              value={totp}
              onChange={setTotp}
              disabled={loading}
              autoFocus
            />
          </div>
        ) : (
          <div>
            <label htmlFor="backup" style={labelStyle}>
              Záložní kód
            </label>
            <input
              id="backup"
              type="text"
              value={backupCode}
              onChange={(e) => setBackupCode(e.target.value.toUpperCase())}
              required
              disabled={loading}
              autoFocus
              placeholder="XXXX-XXXX"
              style={{
                ...inputStyle,
                letterSpacing: "0.1em",
                textAlign: "center",
              }}
              onFocus={(e) => (e.currentTarget.style.borderColor = "var(--ring)")}
              onBlur={(e) => (e.currentTarget.style.borderColor = "var(--border)")}
            />
          </div>
        )}

        {error && (
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
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading || (step === "totp" ? totp.length !== 6 : !backupCode.trim())}
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
          {loading ? "Ověřování…" : "Přihlásit se"}
        </button>

        <button
          type="button"
          onClick={() => {
            setStep(step === "totp" ? "backup" : "totp");
            setError("");
            setTotp("");
            setBackupCode("");
          }}
          style={{
            background: "none",
            border: "none",
            color: "var(--text)",
            fontSize: 12,
            fontWeight: 600,
            textDecoration: "underline",
            cursor: "pointer",
            padding: 0,
          }}
        >
          {step === "totp" ? "Použít záložní kód" : "Použít kód z aplikace"}
        </button>

        <button
          type="button"
          onClick={() => {
            setStep("credentials");
            setLoginChallenge("");
            setTotp("");
            setBackupCode("");
            setError("");
          }}
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

  return (
    <form
      onSubmit={handleCredentialsSubmit}
      style={{ display: "flex", flexDirection: "column", gap: 12 }}
    >
      <div>
        <label htmlFor="username" style={labelStyle}>
          Uživatelské jméno
        </label>
        <input
          id="username"
          name="username"
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
          autoComplete="username"
          placeholder="uživatelské jméno"
          style={inputStyle}
          onFocus={(e) => (e.currentTarget.style.borderColor = "var(--ring)")}
          onBlur={(e) => (e.currentTarget.style.borderColor = "var(--border)")}
        />
      </div>

      <div>
        <label htmlFor="password" style={labelStyle}>
          Heslo
        </label>
        <input
          id="password"
          name="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          autoComplete="current-password"
          placeholder="••••••••"
          style={inputStyle}
          onFocus={(e) => (e.currentTarget.style.borderColor = "var(--ring)")}
          onBlur={(e) => (e.currentTarget.style.borderColor = "var(--border)")}
        />
      </div>

      {error && (
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
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
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
        {loading ? "Přihlašování…" : "Přihlásit se"}
      </button>

      <div style={{ marginTop: 12, textAlign: "center", fontSize: 12 }}>
        <Link
          href="/forgot-password"
          style={{ color: "var(--text)", fontWeight: 600, textDecoration: "underline" }}
        >
          Zapomenuté heslo?
        </Link>
      </div>

      <div
        style={{
          marginTop: 8,
          textAlign: "center",
          fontSize: 12,
          color: "var(--text-muted)",
        }}
      >
        Uchazeč? Vyplňte{" "}
        <a
          href="/public/personalistika"
          style={{ color: "var(--text)", fontWeight: 600, textDecoration: "underline" }}
        >
          veřejný formulář
        </a>
        .
      </div>
    </form>
  );
}

export default function LoginPage() {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "var(--bg)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif",
      }}
    >
      <div
        style={{
          width: 380,
          maxWidth: "calc(100vw - 32px)",
          background: "var(--surface)",
          borderRadius: 16,
          border: "1px solid var(--border)",
          padding: "36px 32px 32px",
          boxShadow: "0 32px 80px rgba(0,0,0,0.12)",
        }}
      >
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: 12,
              background: "linear-gradient(135deg, #e53e3e 0%, #dd6b20 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 900,
              color: "#fff",
              fontSize: 22,
              margin: "0 auto 14px",
            }}
          >
            I
          </div>
          <div
            style={{
              fontSize: 18,
              fontWeight: 700,
              color: "var(--text)",
              letterSpacing: "-0.01em",
            }}
          >
            IGIS new
          </div>
          <div
            style={{
              fontSize: 11,
              color: "var(--text-muted)",
              marginTop: 3,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
            }}
          >
            Modulární intranet
          </div>
        </div>

        <LoginForm />
      </div>
    </div>
  );
}
