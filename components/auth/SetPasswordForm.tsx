"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { signIn } from "next-auth/react";
import {
  authInputStyle,
  authLabelStyle,
  authPrimaryBtn,
} from "@/components/auth/AuthCard";
import {
  PASSWORD_RULES_TEXT,
  validatePassword,
} from "@/lib/password-policy";

type Purpose = "password_reset" | "account_activation";

type ValidatedUser = {
  username: string;
  email: string;
  first_name: string;
  last_name: string;
};

export function SetPasswordForm({
  token,
  purpose,
  submitLabel,
  successTitle,
}: {
  token: string;
  purpose: Purpose;
  submitLabel: string;
  successTitle: string;
}) {
  const [stage, setStage] = useState<"loading" | "ready" | "error" | "done">(
    "loading"
  );
  const [validatedUser, setValidatedUser] = useState<ValidatedUser | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [autoSigningIn, setAutoSigningIn] = useState(false);

  useEffect(() => {
    if (!token) {
      setStage("error");
      setErrorMsg("Chybí token v URL.");
      return;
    }
    fetch(
      `/api/auth/validate-token?purpose=${purpose}&token=${encodeURIComponent(token)}`
    )
      .then(async (r) => ({ ok: r.ok, data: await r.json().catch(() => ({})) }))
      .then(({ ok, data }) => {
        if (!ok) {
          setStage("error");
          setErrorMsg(data.error ?? "Odkaz je neplatný nebo již vypršel.");
          return;
        }
        setValidatedUser(data.user);
        setStage("ready");
      })
      .catch(() => {
        setStage("error");
        setErrorMsg("Chyba při ověření odkazu.");
      });
  }, [token, purpose]);

  const strength = useMemo(() => validatePassword(password), [password]);
  const passwordsMatch = password !== "" && password === password2;
  const canSubmit = strength.ok && passwordsMatch && !submitting;

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setErrorMsg("");
    setSubmitting(true);
    try {
      const endpoint =
        purpose === "password_reset"
          ? "/api/auth/reset-password"
          : "/api/auth/activate";
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErrorMsg(data.error ?? "Chyba při ukládání hesla.");
        setSubmitting(false);
        return;
      }

      setStage("done");
      // Po aktivaci rovnou přihlásit
      if (purpose === "account_activation" && validatedUser?.username) {
        setAutoSigningIn(true);
        try {
          const result = await signIn("credentials", {
            username: validatedUser.username,
            password,
            redirect: false,
          });
          if (result?.ok) {
            window.location.href = "/";
            return;
          }
        } catch {
          // Pokud selže auto-sign-in, uživatel prostě klikne na Přihlásit se
        }
        setAutoSigningIn(false);
      }
    } catch {
      setErrorMsg("Došlo k chybě. Zkuste to prosím znovu.");
      setSubmitting(false);
    }
  };

  if (stage === "loading") {
    return (
      <p style={{ fontSize: 13, color: "var(--text-muted)", textAlign: "center" }}>
        Ověřuji odkaz…
      </p>
    );
  }

  if (stage === "error") {
    return (
      <>
        <div
          style={{
            fontSize: 13,
            color: "var(--danger)",
            background: "color-mix(in oklab, var(--danger) 12%, transparent)",
            border:
              "1px solid color-mix(in oklab, var(--danger) 28%, transparent)",
            borderRadius: 8,
            padding: "12px 14px",
            marginBottom: 12,
          }}
        >
          {errorMsg}
        </div>
        <div style={{ textAlign: "center", fontSize: 12 }}>
          <Link
            href={purpose === "password_reset" ? "/forgot-password" : "/login"}
            style={{
              color: "var(--text)",
              fontWeight: 600,
              textDecoration: "underline",
            }}
          >
            {purpose === "password_reset"
              ? "Požádat o nový odkaz"
              : "Zpět na přihlášení"}
          </Link>
        </div>
      </>
    );
  }

  if (stage === "done") {
    return (
      <>
        <div
          style={{
            fontSize: 14,
            fontWeight: 600,
            color: "var(--text)",
            textAlign: "center",
            marginBottom: 8,
          }}
        >
          {successTitle}
        </div>
        {autoSigningIn ? (
          <p style={{ fontSize: 12, color: "var(--text-muted)", textAlign: "center" }}>
            Přihlašuji vás…
          </p>
        ) : (
          <div style={{ textAlign: "center", fontSize: 13, marginTop: 8 }}>
            <Link
              href="/login"
              style={{
                color: "var(--text)",
                fontWeight: 600,
                textDecoration: "underline",
              }}
            >
              Přihlásit se
            </Link>
          </div>
        )}
      </>
    );
  }

  // stage === "ready"
  const scorePct = Math.max(10, (strength.score / 4) * 100);
  const scoreColor =
    strength.score <= 1
      ? "#dc2626"
      : strength.score === 2
      ? "#f59e0b"
      : strength.score === 3
      ? "#16a34a"
      : "#059669";

  return (
    <>
      {validatedUser && (
        <div
          style={{
            marginBottom: 16,
            padding: "10px 12px",
            borderRadius: 10,
            background: "var(--surface-2)",
            border: "1px solid var(--border)",
            fontSize: 12,
            color: "var(--text-muted)",
            lineHeight: 1.5,
          }}
        >
          <div>
            <span style={{ color: "var(--text)", fontWeight: 600 }}>
              {validatedUser.first_name} {validatedUser.last_name}
            </span>
          </div>
          <div>
            {validatedUser.username} · {validatedUser.email}
          </div>
        </div>
      )}

      <form
        onSubmit={onSubmit}
        style={{ display: "flex", flexDirection: "column", gap: 12 }}
      >
        <div>
          <label htmlFor="pw1" style={authLabelStyle}>
            Nové heslo
          </label>
          <input
            id="pw1"
            type="password"
            required
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            style={authInputStyle}
            onFocus={(e) =>
              (e.currentTarget.style.borderColor = "var(--ring)")
            }
            onBlur={(e) =>
              (e.currentTarget.style.borderColor = "var(--border)")
            }
          />
          {password.length > 0 && (
            <div style={{ marginTop: 8 }}>
              <div
                style={{
                  height: 4,
                  borderRadius: 4,
                  background: "var(--border)",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    width: `${scorePct}%`,
                    height: "100%",
                    background: scoreColor,
                    transition: "width 120ms ease-out",
                  }}
                />
              </div>
              <div
                style={{
                  marginTop: 4,
                  fontSize: 11,
                  color: strength.ok ? "var(--text-muted)" : "#dc2626",
                }}
              >
                {strength.ok ? PASSWORD_RULES_TEXT : strength.error}
              </div>
            </div>
          )}
        </div>

        <div>
          <label htmlFor="pw2" style={authLabelStyle}>
            Zopakujte heslo
          </label>
          <input
            id="pw2"
            type="password"
            required
            autoComplete="new-password"
            value={password2}
            onChange={(e) => setPassword2(e.target.value)}
            placeholder="••••••••"
            style={authInputStyle}
            onFocus={(e) =>
              (e.currentTarget.style.borderColor = "var(--ring)")
            }
            onBlur={(e) =>
              (e.currentTarget.style.borderColor = "var(--border)")
            }
          />
          {password2.length > 0 && !passwordsMatch && (
            <div style={{ marginTop: 4, fontSize: 11, color: "#dc2626" }}>
              Hesla se neshodují.
            </div>
          )}
        </div>

        {errorMsg && (
          <div
            style={{
              fontSize: 11,
              color: "var(--danger)",
              background: "color-mix(in oklab, var(--danger) 12%, transparent)",
              border:
                "1px solid color-mix(in oklab, var(--danger) 28%, transparent)",
              borderRadius: 8,
              padding: "8px 12px",
            }}
          >
            {errorMsg}
          </div>
        )}

        <button
          type="submit"
          disabled={!canSubmit}
          style={{
            ...authPrimaryBtn,
            cursor: canSubmit ? "pointer" : "default",
            opacity: canSubmit ? 1 : 0.6,
          }}
        >
          {submitting ? "Ukládám…" : submitLabel}
        </button>
      </form>
    </>
  );
}
