import type { ReactNode } from "react";

/**
 * Jednotný rámec pro všechny veřejné auth stránky (login, forgot, reset, activate).
 * Záměrně používá inline styly jako /login, aby stránky vypadaly stejně.
 */
export function AuthCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "var(--bg)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily:
          "-apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif",
        padding: 16,
      }}
    >
      <div
        style={{
          width: 420,
          maxWidth: "calc(100vw - 32px)",
          background: "var(--surface)",
          borderRadius: 16,
          border: "1px solid var(--border)",
          padding: "36px 32px 28px",
          boxShadow: "0 32px 80px rgba(0,0,0,0.12)",
        }}
      >
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: 12,
              background:
                "linear-gradient(135deg, #e53e3e 0%, #dd6b20 100%)",
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
              marginTop: 10,
              fontSize: 15,
              fontWeight: 600,
              color: "var(--text)",
            }}
          >
            {title}
          </div>
          {subtitle ? (
            <div
              style={{
                marginTop: 4,
                fontSize: 12,
                color: "var(--text-muted)",
              }}
            >
              {subtitle}
            </div>
          ) : null}
        </div>
        {children}
      </div>
    </div>
  );
}

export const authInputStyle: React.CSSProperties = {
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
};

export const authLabelStyle: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 600,
  color: "var(--text-muted)",
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  display: "block",
  marginBottom: 6,
};

export const authPrimaryBtn: React.CSSProperties = {
  marginTop: 8,
  width: "100%",
  height: 42,
  borderRadius: 10,
  background: "#FFE600",
  border: "none",
  cursor: "pointer",
  color: "var(--bg)",
  fontSize: 14,
  fontWeight: 700,
  transition: "all 120ms ease-out",
  letterSpacing: "0.01em",
};
