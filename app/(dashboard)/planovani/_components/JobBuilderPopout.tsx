"use client";

import JobBuilderForm, { type QueueItemPayload } from "./JobBuilderForm";

const PLANOVANI_ADD_TO_QUEUE = "planovani:addToQueue";
const PLANOVANI_RETURN_TO_PANEL = "planovani:returnToPanel";

export default function JobBuilderPopout() {
  const isPopout = typeof window !== "undefined" && !!window.opener;

  function handleAddToQueue(item: QueueItemPayload) {
    if (isPopout && window.opener) {
      try {
        window.opener.postMessage({ type: PLANOVANI_ADD_TO_QUEUE, payload: item }, window.location.origin);
      } catch {
        console.warn("Nelze odeslat zprávu do hlavního okna.");
      }
    }
  }

  function handleReturnToPanel() {
    if (isPopout && window.opener) {
      try {
        window.opener.postMessage({ type: PLANOVANI_RETURN_TO_PANEL }, window.location.origin);
        window.close();
      } catch {
        console.warn("Nelze zavřít okno.");
      }
    }
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: "var(--background)" }}>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", maxWidth: 420, margin: "0 auto", width: "100%" }}>
        {isPopout && (
          <div style={{ padding: "10px 16px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between", background: "var(--surface)", flexShrink: 0 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text)" }}>Job Builder</span>
            <button
              type="button"
              onClick={handleReturnToPanel}
              style={{
                fontSize: 11, fontWeight: 600, color: "var(--accent)",
                background: "color-mix(in oklab, var(--accent) 12%, transparent)",
                border: "1px solid color-mix(in oklab, var(--accent) 35%, transparent)",
                borderRadius: 6, padding: "4px 10px", cursor: "pointer",
                transition: "all 120ms ease-out",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "color-mix(in oklab, var(--accent) 20%, transparent)";
                e.currentTarget.style.borderColor = "color-mix(in oklab, var(--accent) 50%, transparent)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "color-mix(in oklab, var(--accent) 12%, transparent)";
                e.currentTarget.style.borderColor = "color-mix(in oklab, var(--accent) 35%, transparent)";
              }}
            >
              ← Vrátit do panelu
            </button>
          </div>
        )}
        <JobBuilderForm onAddToQueue={handleAddToQueue} showHeader={!isPopout} />
      </div>
    </div>
  );
}
