"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isDark = mounted && (resolvedTheme ?? "light") === "dark";

  if (!mounted) {
    return (
      <div
        style={{
          width: 64,
          height: 30,
          borderRadius: 999,
          background: "var(--surface-2)",
          border: "1px solid var(--border)",
        }}
      />
    );
  }

  return (
    <button
      type="button"
      aria-label={isDark ? "Přepnout na světlý režim" : "Přepnout na tmavý režim"}
      title={isDark ? "Přepnout na světlý režim" : "Přepnout na tmavý režim"}
      onClick={() => setTheme(isDark ? "light" : "dark")}
      style={{
        width: 64,
        height: 30,
        borderRadius: 999,
        background: "var(--surface-2)",
        border: "1px solid var(--border)",
        cursor: "pointer",
        position: "relative",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 8px",
        transition: "all 180ms ease-out",
      }}
    >
      <span style={{ fontSize: 12, opacity: isDark ? 0.35 : 1, transition: "opacity 180ms" }}>
        ☀️
      </span>
      <span style={{ fontSize: 12, opacity: isDark ? 1 : 0.35, transition: "opacity 180ms" }}>
        🌙
      </span>
      <span
        style={{
          position: "absolute",
          top: 2,
          left: isDark ? 34 : 2,
          width: 26,
          height: 26,
          borderRadius: "50%",
          background: "var(--background)",
          border: "1px solid var(--border)",
          boxShadow: "0 2px 8px color-mix(in oklab, var(--foreground) 18%, transparent)",
          transition: "left 180ms ease-out",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 12,
        }}
      >
        {isDark ? "🌙" : "☀️"}
      </span>
    </button>
  );
}
