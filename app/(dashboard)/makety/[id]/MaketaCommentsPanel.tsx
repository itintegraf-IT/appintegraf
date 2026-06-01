"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { formatDateTimeCz } from "@/lib/datetime-cz";

type Comment = {
  id: number;
  body: string;
  created_at: string;
  users: { first_name: string; last_name: string };
};

export function MaketaCommentsPanel({ maketaId }: { maketaId: number }) {
  const router = useRouter();
  const [comments, setComments] = useState<Comment[]>([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/makety/${maketaId}/comments`);
      const data = await res.json();
      if (res.ok) setComments(data.comments ?? []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [maketaId]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const body = text.trim();
    if (!body) return;
    setSending(true);
    setError(null);
    try {
      const res = await fetch(`/api/makety/${maketaId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Odeslání se nezdařilo");
      } else {
        setText("");
        await load();
        router.refresh();
      }
    } catch {
      setError("Síťová chyba");
    }
    setSending(false);
  };

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <h3 className="mb-3 text-sm font-semibold text-gray-800">Komentáře</h3>
      {loading ? (
        <p className="text-sm text-gray-500">Načítám…</p>
      ) : comments.length === 0 ? (
        <p className="mb-3 text-sm text-gray-500">Zatím bez komentářů.</p>
      ) : (
        <ul className="mb-4 max-h-64 space-y-3 overflow-y-auto">
          {comments.map((c) => (
            <li key={c.id} className="rounded-lg bg-gray-50 px-3 py-2 text-sm">
              <p className="font-medium text-gray-800">
                {c.users.first_name} {c.users.last_name}
                <span className="ml-2 text-xs font-normal text-gray-500">
                  {formatDateTimeCz(new Date(c.created_at))}
                </span>
              </p>
              <p className="mt-1 whitespace-pre-wrap text-gray-700">{c.body}</p>
            </li>
          ))}
        </ul>
      )}
      <form onSubmit={onSubmit} className="space-y-2">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={3}
          placeholder="Napište zprávu…"
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={sending}
          className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-50"
        >
          {sending ? "Odesílám…" : "Odeslat"}
        </button>
      </form>
    </div>
  );
}
