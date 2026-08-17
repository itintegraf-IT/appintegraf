"use client";

import { useCallback, useEffect, useState } from "react";
import { formatDateTimeCz } from "@/lib/datetime-cz";
import { maketyFileKindLabel } from "@/lib/makety-file-kind";

type EventRow = {
  id: number;
  event_type: string;
  event_label: string;
  file_id: number | null;
  meta: Record<string, unknown> | null;
  created_at: string;
  user: string | null;
};

function metaSummary(meta: Record<string, unknown> | null): string | null {
  if (!meta) return null;
  const parts: string[] = [];
  if (typeof meta.filename === "string") parts.push(meta.filename);
  if (typeof meta.document_type === "string") {
    parts.push(maketyFileKindLabel(meta.document_type));
  }
  if (typeof meta.from === "string" || typeof meta.to === "string") {
    parts.push(
      `${maketyFileKindLabel(String(meta.from ?? ""))} → ${maketyFileKindLabel(String(meta.to ?? ""))}`
    );
  }
  if (typeof meta.to_email === "string") parts.push(`→ ${meta.to_email}`);
  if (typeof meta.from_label === "string" && typeof meta.to_label === "string") {
    parts.push(`${meta.from_label} → ${meta.to_label}`);
  } else if (typeof meta.from_status === "string" && typeof meta.to_status === "string") {
    parts.push(`${meta.from_status} → ${meta.to_status}`);
  }
  if (typeof meta.message === "string" && meta.message) {
    parts.push(`„${meta.message.slice(0, 80)}${meta.message.length > 80 ? "…" : ""}“`);
  }
  if (typeof meta.reason === "string" && meta.reason) {
    parts.push(`„${meta.reason.slice(0, 80)}${meta.reason.length > 80 ? "…" : ""}“`);
  }
  return parts.length > 0 ? parts.join(" · ") : null;
}

export function MaketyFileEventsPanel({ maketaId }: { maketaId: number }) {
  const [events, setEvents] = useState<EventRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/makety/${maketaId}/file-events`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Načtení historie selhalo");
        setEvents([]);
        return;
      }
      setEvents(data.events ?? []);
    } catch {
      setError("Síťová chyba");
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, [maketaId]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-gray-800">Historie souborů a workflow</h3>
        <button
          type="button"
          onClick={() => void load()}
          className="text-xs font-medium text-violet-600 hover:underline"
        >
          Obnovit
        </button>
      </div>
      {loading ? (
        <p className="text-sm text-gray-500">Načítám…</p>
      ) : error ? (
        <p className="text-sm text-red-600">{error}</p>
      ) : events.length === 0 ? (
        <p className="text-sm text-gray-500">Zatím žádné záznamy.</p>
      ) : (
        <ul className="max-h-96 space-y-3 overflow-y-auto pr-1">
          {events.map((ev) => {
            const detail = metaSummary(ev.meta);
            return (
              <li key={ev.id} className="border-b border-gray-100 pb-2 last:border-0">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="text-sm font-medium text-gray-900">{ev.event_label}</span>
                  <time className="text-xs text-gray-500">
                    {formatDateTimeCz(new Date(ev.created_at))}
                  </time>
                </div>
                <p className="text-xs text-gray-600">
                  {ev.user ?? "—"}
                  {detail ? ` · ${detail}` : ""}
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
