"use client";

import { signIn } from "next-auth/react";
import { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

function LoginForm() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") ?? "/";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const result = await signIn("credentials", {
        username,
        password,
        redirect: false,
      });

      if (result?.error) {
        setError("Neplatné uživatelské jméno nebo heslo.");
        setLoading(false);
        return;
      }

      if (result?.ok) {
        window.location.href = callbackUrl;
        return;
      }
    } catch {
      setError("Došlo k chybě při přihlášení.");
    }
    setLoading(false);
  }

  return (
    <form
      onSubmit={handleSubmit}
      style={{ display: "flex", flexDirection: "column", gap: 12 }}
    >
      <div>
        <label
          htmlFor="username"
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
          style={{
            width: "100%",
            boxSizing: "border-box",
            height: 40,
            borderRadius: 10,
            background: "var(--surface-2)",
            border: "1px solid var(--border)",
            color: "var(--text)",
            fontSize: 14,
            padding: "0 12px",
            outline: "none",
            transition: "border-color 120ms ease-out",
          }}
          onFocus={(e) => (e.currentTarget.style.borderColor = "var(--ring)")}
          onBlur={(e) => (e.currentTarget.style.borderColor = "var(--border)")}
        />
      </div>

      <div>
        <label
          htmlFor="password"
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
          style={{
            width: "100%",
            boxSizing: "border-box",
            height: 40,
            borderRadius: 10,
            background: "var(--surface-2)",
            border: "1px solid var(--border)",
            color: "var(--text)",
            fontSize: 14,
            padding: "0 12px",
            outline: "none",
            transition: "border-color 120ms ease-out",
          }}
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
          transition: "all 120ms ease-out",
          letterSpacing: "0.01em",
          opacity: loading ? 0.7 : 1,
        }}
      >
        {loading ? "Přihlašování…" : "Přihlásit se"}
      </button>

      <div
        style={{
          marginTop: 12,
          textAlign: "center",
          fontSize: 12,
        }}
      >
        <Link
          href="/forgot-password"
          style={{
            color: "var(--text)",
            fontWeight: 600,
            textDecoration: "underline",
          }}
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
            INTEGRAF
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

        <Suspense fallback={<div style={{ height: 200 }} />}>
          <LoginForm />
        </Suspense>
      </div>
    </div>
  );
}
