"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { formatDateTimeCz } from "@/lib/datetime-cz";
import type { MaketyCommentParticipant } from "@/lib/makety-comment-participants";

type Comment = {
  id: number;
  body: string;
  created_at: string;
  users: { first_name: string; last_name: string };
  notify_user_ids?: number[];
  notify_users?: Array<{ id: number; name: string; roleLabel?: string | null }>;
};

export function MaketaCommentsPanel({
  maketaId,
  participants,
  redirectToListAfterSubmit = false,
}: {
  maketaId: number;
  /** Účastníci, které lze upozornit (bez aktuálního uživatele). */
  participants: MaketyCommentParticipant[];
  /** Po odeslání přejít na přehled (např. po doplnění nové zakázky). */
  redirectToListAfterSubmit?: boolean;
}) {
  const router = useRouter();
  const [comments, setComments] = useState<Comment[]>([]);
  const [text, setText] = useState("");
  const [notifyIds, setNotifyIds] = useState<number[]>([]);
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
    void load();
  }, [maketaId]);

  const toggleNotify = (userId: number) => {
    setNotifyIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  const roleLabelFor = (userId: number): string | null => {
    return participants.find((p) => p.userId === userId)?.roleLabel ?? null;
  };

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
        body: JSON.stringify({
          body,
          notifyUserIds: notifyIds,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Odeslání se nezdařilo");
      } else {
        setText("");
        setNotifyIds([]);
        if (redirectToListAfterSubmit) {
          router.push("/makety?comment_sent=1");
          return;
        }
        await load();
        router.refresh();
      }
    } catch {
      setError("Síťová chyba");
    } finally {
      setSending(false);
    }
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
          {comments.map((c) => {
            const notified =
              c.notify_users ??
              (c.notify_user_ids ?? []).map((id) => ({
                id,
                name: `#${id}`,
                roleLabel: roleLabelFor(id),
              }));
            return (
              <li key={c.id} className="rounded-lg bg-gray-50 px-3 py-2 text-sm">
                <p className="font-medium text-gray-800">
                  {c.users.first_name} {c.users.last_name}
                  <span className="ml-2 text-xs font-normal text-gray-500">
                    {formatDateTimeCz(new Date(c.created_at))}
                  </span>
                </p>
                {notified.length > 0 && (
                  <p className="mt-0.5 text-xs text-violet-700">
                    Upozorněni:{" "}
                    {notified
                      .map((u) => {
                        const role = u.roleLabel ?? roleLabelFor(u.id);
                        return role ? `${u.name} (${role})` : u.name;
                      })
                      .join(", ")}
                  </p>
                )}
                <p className="mt-1 whitespace-pre-wrap text-gray-700">{c.body}</p>
              </li>
            );
          })}
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
        {participants.length > 0 && (
          <fieldset className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
            <legend className="px-1 text-xs font-medium text-gray-600">
              Upozornit
            </legend>
            <p className="mb-2 text-xs text-gray-500">
              Komentář uvidí všichni. Notifikaci dostanou jen vybraní.
            </p>
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              {participants.map((p) => (
                <label
                  key={p.userId}
                  className="flex items-center gap-1.5 text-sm text-gray-800"
                >
                  <input
                    type="checkbox"
                    checked={notifyIds.includes(p.userId)}
                    onChange={() => toggleNotify(p.userId)}
                    disabled={sending}
                  />
                  <span>
                    {p.firstName} {p.lastName}
                    <span className="text-gray-500"> ({p.roleLabel})</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
        )}
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
