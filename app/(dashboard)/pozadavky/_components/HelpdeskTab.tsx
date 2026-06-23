"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import {
  HELPDESK_CATEGORY_LABELS,
  HELPDESK_PRIORITY_LABELS,
  HELPDESK_STATUS_BADGE,
  HELPDESK_STATUS_LABELS,
} from "@/lib/helpdesk/labels";
import { safeJson } from "@/lib/safe-json-response";

type Member = { id: number; first_name: string; last_name: string; email: string };

type Ticket = {
  id: number;
  ticket_number: string;
  subject: string;
  description: string;
  category: string;
  priority: string;
  status: string;
  resolution_note: string | null;
  created_at: string;
  users_requester: { id: number; first_name: string; last_name: string; email: string };
  users_assigned: { id: number; first_name: string; last_name: string } | null;
};

type Comment = {
  id: number;
  body: string;
  is_internal: boolean;
  created_at: string;
  users: { first_name: string; last_name: string };
};

type TicketDetail = Ticket & { comments: Comment[] };

export function HelpdeskTab() {
  const searchParams = useSearchParams();
  const highlightId = searchParams?.get("id") ? parseInt(searchParams.get("id")!, 10) : null;
  const viewQueue = searchParams?.get("view") === "queue";

  const [canManage, setCanManage] = useState(false);
  const [itMembers, setItMembers] = useState<Member[]>([]);
  const [myTickets, setMyTickets] = useState<Ticket[]>([]);
  const [queueTickets, setQueueTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [expandedId, setExpandedId] = useState<number | null>(highlightId);
  const [detail, setDetail] = useState<TicketDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [internalComment, setInternalComment] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const [form, setForm] = useState({
    subject: "",
    description: "",
    category: "jine",
    priority: "stredni",
  });

  const [manageForm, setManageForm] = useState({
    status: "",
    assigned_to_id: "",
    resolution_note: "",
  });

  const fetchContext = useCallback(() => {
    return fetch("/api/helpdesk/context")
      .then((r) => safeJson(r))
      .then((data) => {
        setCanManage(Boolean(data.canManageHelpdesk));
        setItMembers((data.itMembers as Member[]) ?? []);
        return Boolean(data.canManageHelpdesk);
      });
  }, []);

  const fetchMine = useCallback(() => {
    return fetch("/api/helpdesk/tickets/mine")
      .then((r) => safeJson(r))
      .then((data) => setMyTickets((data.tickets as Ticket[]) ?? []))
      .catch(() => setMyTickets([]));
  }, []);

  const fetchQueue = useCallback(() => {
    return fetch("/api/helpdesk/tickets?status=open")
      .then((r) => safeJson(r))
      .then((data) => setQueueTickets((data.tickets as Ticket[]) ?? []))
      .catch(() => setQueueTickets([]));
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    const isManager = await fetchContext();
    await fetchMine();
    if (isManager) await fetchQueue();
    setLoading(false);
  }, [fetchContext, fetchMine, fetchQueue]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (highlightId) setExpandedId(highlightId);
  }, [highlightId]);

  const loadDetail = (id: number) => {
    setDetailLoading(true);
    fetch(`/api/helpdesk/tickets/${id}`)
      .then((r) => safeJson(r))
      .then((data) => {
        const t = data.ticket as TicketDetail | undefined;
        setDetail(t ?? null);
        if (t) {
          setManageForm({
            status: t.status,
            assigned_to_id: t.users_assigned ? String(t.users_assigned.id) : "",
            resolution_note: t.resolution_note ?? "",
          });
        }
      })
      .catch(() => setDetail(null))
      .finally(() => setDetailLoading(false));
  };

  useEffect(() => {
    if (expandedId) loadDetail(expandedId);
    else setDetail(null);
  }, [expandedId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setSubmitLoading(true);

    try {
      const res = await fetch("/api/helpdesk/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await safeJson(res);

      if (!res.ok) {
        setError(String(data.error ?? "Chyba při vytváření ticketu"));
        setSubmitLoading(false);
        return;
      }

      setSuccess(String(data.message ?? "Ticket vytvořen"));
      setForm({ subject: "", description: "", category: "jine", priority: "stredni" });
      await refresh();
      const ticket = data.ticket as Ticket | undefined;
      if (ticket?.id) setExpandedId(ticket.id);
    } catch {
      setError("Chyba při vytváření ticketu");
    }
    setSubmitLoading(false);
  };

  const handlePatch = async () => {
    if (!expandedId) return;
    setActionLoading(true);
    setError("");

    const res = await fetch(`/api/helpdesk/tickets/${expandedId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status: manageForm.status,
        assigned_to_id: manageForm.assigned_to_id || null,
        resolution_note: manageForm.resolution_note,
      }),
    });
    const data = await safeJson(res);

    if (!res.ok) {
      setError(String(data.error ?? "Chyba při ukládání"));
      setActionLoading(false);
      return;
    }

    await refresh();
    loadDetail(expandedId);
    setActionLoading(false);
  };

  const handleClose = async () => {
    if (!expandedId) return;
    setActionLoading(true);
    const res = await fetch(`/api/helpdesk/tickets/${expandedId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "close" }),
    });
    if (res.ok) {
      await refresh();
      loadDetail(expandedId);
    }
    setActionLoading(false);
  };

  const handleComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!expandedId || !commentText.trim()) return;
    setActionLoading(true);

    const res = await fetch(`/api/helpdesk/tickets/${expandedId}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: commentText, is_internal: internalComment }),
    });

    if (res.ok) {
      setCommentText("");
      setInternalComment(false);
      loadDetail(expandedId);
    }
    setActionLoading(false);
  };

  const renderTicketCard = (ticket: Ticket, showRequester = false) => (
    <div
      key={ticket.id}
      className={`rounded-xl border bg-white shadow-sm ${
        expandedId === ticket.id ? "border-red-300 ring-1 ring-red-200" : "border-gray-200"
      }`}
    >
      <button
        type="button"
        onClick={() => setExpandedId(expandedId === ticket.id ? null : ticket.id)}
        className="w-full p-4 text-left"
      >
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <span className="font-mono text-sm text-gray-500">{ticket.ticket_number}</span>
            <p className="font-medium text-gray-900">{ticket.subject}</p>
            {showRequester && (
              <p className="text-sm text-gray-500">
                {ticket.users_requester.first_name} {ticket.users_requester.last_name}
              </p>
            )}
          </div>
          <span
            className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${HELPDESK_STATUS_BADGE[ticket.status] ?? "bg-gray-100"}`}
          >
            {HELPDESK_STATUS_LABELS[ticket.status] ?? ticket.status}
          </span>
        </div>
        <p className="mt-2 line-clamp-2 text-sm text-gray-600">{ticket.description}</p>
        <p className="mt-2 text-xs text-gray-500">
          {HELPDESK_CATEGORY_LABELS[ticket.category]} ·{" "}
          {HELPDESK_PRIORITY_LABELS[ticket.priority]} ·{" "}
          {new Date(ticket.created_at).toLocaleString("cs-CZ")}
        </p>
      </button>

      {expandedId === ticket.id && (
        <div className="border-t border-gray-100 p-4">
          {detailLoading ? (
            <p className="text-sm text-gray-500">Načítám detail…</p>
          ) : detail ? (
            <div className="space-y-4">
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{detail.description}</p>

              {detail.resolution_note && (
                <div className="rounded-lg bg-green-50 p-3 text-sm">
                  <p className="font-medium text-green-900">Řešení</p>
                  <p className="text-green-800">{detail.resolution_note}</p>
                </div>
              )}

              {detail.comments.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-gray-900">Komentáře</p>
                  {detail.comments.map((c) => (
                    <div
                      key={c.id}
                      className={`rounded-lg p-3 text-sm ${c.is_internal ? "bg-amber-50" : "bg-gray-50"}`}
                    >
                      <p className="text-xs text-gray-500">
                        {c.users.first_name} {c.users.last_name}
                        {c.is_internal && " · interní"} ·{" "}
                        {new Date(c.created_at).toLocaleString("cs-CZ")}
                      </p>
                      <p className="mt-1 text-gray-800 whitespace-pre-wrap">{c.body}</p>
                    </div>
                  ))}
                </div>
              )}

              <form onSubmit={handleComment} className="space-y-2">
                <textarea
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  rows={2}
                  placeholder="Napsat komentář…"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
                {canManage && (
                  <label className="flex items-center gap-2 text-sm text-gray-600">
                    <input
                      type="checkbox"
                      checked={internalComment}
                      onChange={(e) => setInternalComment(e.target.checked)}
                    />
                    Interní poznámka (nevidí žadatel)
                  </label>
                )}
                <button
                  type="submit"
                  disabled={actionLoading || !commentText.trim()}
                  className="rounded-lg border border-gray-300 px-4 py-1.5 text-sm hover:bg-gray-50 disabled:opacity-50"
                >
                  Odeslat komentář
                </button>
              </form>

              {canManage && (
                <div className="rounded-lg border border-gray-200 p-4 space-y-3">
                  <p className="text-sm font-medium text-gray-900">Správa ticketu (IT)</p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-xs text-gray-600">Stav</label>
                      <select
                        value={manageForm.status}
                        onChange={(e) => setManageForm({ ...manageForm, status: e.target.value })}
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                      >
                        {Object.entries(HELPDESK_STATUS_LABELS).map(([k, v]) => (
                          <option key={k} value={k}>
                            {v}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="mb-1 block text-xs text-gray-600">Přiřazeno</label>
                      <select
                        value={manageForm.assigned_to_id}
                        onChange={(e) =>
                          setManageForm({ ...manageForm, assigned_to_id: e.target.value })
                        }
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                      >
                        <option value="">— Nepřiřazeno —</option>
                        {itMembers.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.first_name} {m.last_name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  {manageForm.status === "vyreseno" && (
                    <div>
                      <label className="mb-1 block text-xs text-gray-600">Popis řešení</label>
                      <textarea
                        value={manageForm.resolution_note}
                        onChange={(e) =>
                          setManageForm({ ...manageForm, resolution_note: e.target.value })
                        }
                        rows={2}
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                      />
                    </div>
                  )}
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={handlePatch}
                      disabled={actionLoading}
                      className="rounded-lg bg-red-600 px-4 py-1.5 text-sm text-white hover:bg-red-700 disabled:opacity-50"
                    >
                      Uložit změny
                    </button>
                  </div>
                </div>
              )}

              {!canManage && (detail.status === "vyreseno" || detail.status === "uzavreno") && (
                <button
                  type="button"
                  onClick={handleClose}
                  disabled={actionLoading || detail.status === "uzavreno"}
                  className="rounded-lg border border-gray-300 px-4 py-1.5 text-sm hover:bg-gray-50 disabled:opacity-50"
                >
                  {detail.status === "uzavreno" ? "Uzavřeno" : "Uzavřít ticket"}
                </button>
              )}
            </div>
          ) : null}
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-8">
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">Nový helpdesk ticket</h2>
        <form onSubmit={handleSubmit}>
          {error && (
            <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>
          )}
          {success && (
            <div className="mb-4 rounded-lg bg-green-50 p-3 text-sm text-green-700">{success}</div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="mb-1 block text-sm font-medium text-gray-700">Předmět *</label>
              <input
                type="text"
                required
                value={form.subject}
                onChange={(e) => setForm({ ...form, subject: e.target.value })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Kategorie</label>
              <select
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2"
              >
                {Object.entries(HELPDESK_CATEGORY_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Priorita</label>
              <select
                value={form.priority}
                onChange={(e) => setForm({ ...form, priority: e.target.value })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2"
              >
                {Object.entries(HELPDESK_PRIORITY_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-sm font-medium text-gray-700">Popis problému *</label>
              <textarea
                required
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={4}
                className="w-full rounded-lg border border-gray-300 px-3 py-2"
              />
            </div>
          </div>

          <div className="mt-6">
            <button
              type="submit"
              disabled={submitLoading}
              className="rounded-lg bg-red-600 px-6 py-2 font-medium text-white hover:bg-red-700 disabled:opacity-50"
            >
              {submitLoading ? "Vytvářím…" : "Vytvořit ticket"}
            </button>
          </div>
        </form>
      </div>

      {canManage && (viewQueue || queueTickets.length > 0) && (
        <div>
          <h2 className="mb-4 text-lg font-semibold text-gray-900">IT fronta</h2>
          {loading ? (
            <p className="text-sm text-gray-500">Načítám…</p>
          ) : queueTickets.length === 0 ? (
            <p className="text-sm text-gray-500">Žádné otevřené tickety.</p>
          ) : (
            <div className="space-y-3">
              {queueTickets.map((t) => renderTicketCard(t, true))}
            </div>
          )}
        </div>
      )}

      <div>
        <h2 className="mb-4 text-lg font-semibold text-gray-900">Moje tickety</h2>
        {loading ? (
          <p className="text-sm text-gray-500">Načítám…</p>
        ) : myTickets.length === 0 ? (
          <p className="text-sm text-gray-500">Zatím nemáte žádné tickety.</p>
        ) : (
          <div className="space-y-3">{myTickets.map((t) => renderTicketCard(t))}</div>
        )}
      </div>
    </div>
  );
}
