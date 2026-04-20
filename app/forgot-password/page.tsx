"use client";

import { useState } from "react";
import Link from "next/link";
import {
  AuthCard,
  authInputStyle,
  authLabelStyle,
  authPrimaryBtn,
} from "@/components/auth/AuthCard";

export default function ForgotPasswordPage() {
  const [login, setLogin] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ login: login.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Nepodařilo se odeslat žádost.");
        setLoading(false);
        return;
      }
      setSent(true);
    } catch {
      setError("Došlo k chybě při odesílání žádosti.");
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <AuthCard title="Odkaz odeslán" subtitle="Zkontrolujte e-mailovou schránku">
        <p style={{ fontSize: 13, color: "var(--text)", lineHeight: 1.5 }}>
          Pokud účet s těmito údaji v systému existuje, odeslali jsme na
          přiřazený e-mail odkaz pro nastavení nového hesla. Platnost odkazu je{" "}
          <strong>30 minut</strong>.
        </p>
        <p
          style={{
            marginTop: 12,
            fontSize: 12,
            color: "var(--text-muted)",
            lineHeight: 1.5,
          }}
        >
          Nedorazil e-mail? Zkontrolujte složku Spam, případně počkejte pár
          minut. Pokud máte dlouhodobě potíže, kontaktujte správce aplikace.
        </p>
        <div
          style={{
            marginTop: 20,
            textAlign: "center",
            fontSize: 12,
          }}
        >
          <Link
            href="/login"
            style={{
              color: "var(--text)",
              fontWeight: 600,
              textDecoration: "underline",
            }}
          >
            Zpět na přihlášení
          </Link>
        </div>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Zapomenuté heslo"
      subtitle="Zadejte přihlašovací jméno nebo e-mail"
    >
      <form
        onSubmit={handleSubmit}
        style={{ display: "flex", flexDirection: "column", gap: 12 }}
      >
        <div>
          <label htmlFor="login" style={authLabelStyle}>
            Uživatelské jméno nebo e-mail
          </label>
          <input
            id="login"
            type="text"
            required
            value={login}
            onChange={(e) => setLogin(e.target.value)}
            autoComplete="username"
            placeholder="uzivatel@firma.cz"
            style={authInputStyle}
            onFocus={(e) =>
              (e.currentTarget.style.borderColor = "var(--ring)")
            }
            onBlur={(e) =>
              (e.currentTarget.style.borderColor = "var(--border)")
            }
          />
        </div>

        {error && (
          <div
            style={{
              fontSize: 11,
              color: "var(--danger)",
              background:
                "color-mix(in oklab, var(--danger) 12%, transparent)",
              border:
                "1px solid color-mix(in oklab, var(--danger) 28%, transparent)",
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
            ...authPrimaryBtn,
            cursor: loading ? "default" : "pointer",
            opacity: loading ? 0.7 : 1,
          }}
        >
          {loading ? "Odesílám…" : "Odeslat odkaz pro obnovu"}
        </button>

        <div
          style={{
            marginTop: 8,
            textAlign: "center",
            fontSize: 12,
            color: "var(--text-muted)",
          }}
        >
          <Link
            href="/login"
            style={{
              color: "var(--text)",
              fontWeight: 600,
              textDecoration: "underline",
            }}
          >
            Zpět na přihlášení
          </Link>
        </div>
      </form>
    </AuthCard>
  );
}
