"use client";

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  HELPDESK_CATEGORIES,
  HELPDESK_CATEGORY_LABELS,
  HELPDESK_PRIORITIES,
  HELPDESK_PRIORITY_LABELS,
  HELPDESK_STATUS_BADGE,
  HELPDESK_STATUS_LABELS,
  HELPDESK_STATUSES,
} from "@/lib/helpdesk/labels";
import { safeJson } from "@/lib/safe-json-response";
import {
  HelpdeskAttachmentsPanel,
  HelpdeskPendingFilesPicker,
  uploadHelpdeskCommentFiles,
} from "./HelpdeskAttachmentsPanel";

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

type Filters = {
  status: string;
  priority: string;
  category: string;
  assigned_to: string;
  requester_id: string;
  q: string;
  page: number;
};

const DEFAULT_FILTERS: Filters = {
  status: "open",
  priority: "",
  category: "",
  assigned_to: "",
  requester_id: "",
  q: "",
  page: 1,
};

function filtersFromSearchParams(sp: URLSearchParams): Filters {
  return {
    status: sp.get("status") || "open",
    priority: sp.get("priority") || "",
    category: sp.get("category") || "",
    assigned_to: sp.get("assigned_to") || "",
    requester_id: sp.get("requester_id") || "",
    q: sp.get("q") || "",
    page: Math.max(1, parseInt(sp.get("page") || "1", 10) || 1),
  };
}

function buildQuery(filters: Filters, id?: number | null): string {
  const p = new URLSearchParams();
  if (filters.status && filters.status !== "open") p.set("status", filters.status);
  else if (filters.status === "open") p.set("status", "open");
  if (filters.priority) p.set("priority", filters.priority);
  if (filters.category) p.set("category", filters.category);
  if (filters.assigned_to) p.set("assigned_to", filters.assigned_to);
  if (filters.requester_id) p.set("requester_id", filters.requester_id);
  if (filters.q.trim()) p.set("q", filters.q.trim());
  if (filters.page > 1) p.set("page", String(filters.page));
  if (id) p.set("id", String(id));
  const s = p.toString();
  return s ? `?${s}` : "";
}

function personName(u: { first_name: string; last_name: string } | null | undefined): string {
  if (!u) return "—";
  return `${u.first_name} ${u.last_name}`;
}

export function HelpdeskManageClient() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const filters = useMemo(
    () => filtersFromSearchParams(new URLSearchParams(searchParams?.toString() ?? "")),
    [searchParams]
  );
  const highlightId = searchParams?.get("id") ? parseInt(searchParams.get("id")!, 10) : null;

  const [userId, setUserId] = useState<number | null>(null);
  const [itMembers, setItMembers] = useState<Member[]>([]);
  const [requesters, setRequesters] = useState<Member[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [total, setTotal] = useState(0);
  const [limit, setLimit] = useState(50);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expandedId, setExpandedId] = useState<number | null>(highlightId);
  const [detail, setDetail] = useState<TicketDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [internalComment, setInternalComment] = useState(false);
  const [pendingCommentFiles, setPendingCommentFiles] = useState<File[]>([]);
  const [actionLoading, setActionLoading] = useState(false);
  const [draftQ, setDraftQ] = useState(filters.q);
  const [manageForm, setManageForm] = useState({
    status: "",
    assigned_to_id: "",
    resolution_note: "",
  });

  const pushFilters = useCallback(
    (next: Filters, id: number | null = highlightId) => {
      router.replace(`${pathname}${buildQuery(next, id)}`);
    },
    [router, pathname, highlightId]
  );

  const loadList = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const p = new URLSearchParams();
      p.set("status", filters.status || "open");
      if (filters.priority) p.set("priority", filters.priority);
      if (filters.category) p.set("category", filters.category);
      if (filters.assigned_to) p.set("assigned_to", filters.assigned_to);
      if (filters.requester_id) p.set("requester_id", filters.requester_id);
      if (filters.q.trim()) p.set("q", filters.q.trim());
      p.set("page", String(filters.page));
      p.set("limit", "50");

      const res = await fetch(`/api/helpdesk/tickets?${p.toString()}`);
      const data = await safeJson(res);
      if (!res.ok) {
        setError(String(data.error ?? "Nepodařilo se načíst tickety"));
        setTickets([]);
        setTotal(0);
        return;
      }
      setTickets((data.tickets as Ticket[]) ?? []);
      setTotal(Number(data.total) || 0);
      setLimit(Number(data.limit) || 50);
    } catch {
      setError("Chyba při načítání");
      setTickets([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetch("/api/helpdesk/context")
      .then((r) => safeJson(r))
      .then((data) => {
        setUserId(typeof data.userId === "number" ? data.userId : null);
        setItMembers((data.itMembers as Member[]) ?? []);
        setRequesters((data.requesters as Member[]) ?? []);
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    loadList();
  }, [loadList]);

  useEffect(() => {
    setDraftQ(filters.q);
  }, [filters.q]);

  useEffect(() => {
    if (highlightId) setExpandedId(highlightId);
  }, [highlightId]);

  const loadDetail = useCallback((id: number) => {
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
  }, []);

  useEffect(() => {
    if (expandedId) loadDetail(expandedId);
    else setDetail(null);
  }, [expandedId, loadDetail]);

  const setFilter = (key: keyof Filters, value: string) => {
    const next = { ...filters, [key]: value, page: 1 };
    if (key === "q") next.q = value;
    pushFilters(next);
  };

  const applySearch = (e: React.FormEvent) => {
    e.preventDefault();
    pushFilters({ ...filters, q: draftQ, page: 1 });
  };

  const resetFilters = () => {
    setDraftQ("");
    pushFilters({ ...DEFAULT_FILTERS }, null);
  };

  const toggleRow = (id: number) => {
    const next = expandedId === id ? null : id;
    setExpandedId(next);
    pushFilters(filters, next);
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
    await loadList();
    loadDetail(expandedId);
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
    const data = await safeJson(res);
    if (res.ok) {
      const comment = data.comment as { id: number } | undefined;
      if (comment?.id && pendingCommentFiles.length > 0) {
        const uploadErrors = await uploadHelpdeskCommentFiles(
          expandedId,
          comment.id,
          pendingCommentFiles
        );
        if (uploadErrors.length > 0) {
          setError(`Komentář odeslán, ale přílohy selhaly: ${uploadErrors.join("; ")}`);
        }
      }
      setCommentText("");
      setInternalComment(false);
      setPendingCommentFiles([]);
      loadDetail(expandedId);
    }
    setActionLoading(false);
  };

  const totalPages = Math.max(1, Math.ceil(total / limit));
  const ticketOpen = detail?.status !== "uzavreno";
  const canUploadAttachments = Boolean(ticketOpen && detail);

  return (
    <div className="space-y-4">
      <form
        onSubmit={applySearch}
        className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
      >
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          <label className="text-sm">
            <span className="mb-1 block text-gray-600">Stav</span>
            <select
              value={filters.status}
              onChange={(e) => setFilter("status", e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2"
            >
              <option value="open">Otevřené (bez uzavřených)</option>
              <option value="all">Vše</option>
              {HELPDESK_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {HELPDESK_STATUS_LABELS[s]}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-gray-600">Priorita</span>
            <select
              value={filters.priority}
              onChange={(e) => setFilter("priority", e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2"
            >
              <option value="">— Vše —</option>
              {HELPDESK_PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {HELPDESK_PRIORITY_LABELS[p]}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-gray-600">Kategorie</span>
            <select
              value={filters.category}
              onChange={(e) => setFilter("category", e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2"
            >
              <option value="">— Vše —</option>
              {HELPDESK_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {HELPDESK_CATEGORY_LABELS[c]}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-gray-600">Řešitel</span>
            <select
              value={filters.assigned_to}
              onChange={(e) => setFilter("assigned_to", e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2"
            >
              <option value="">— Všichni —</option>
              <option value="unassigned">Nepřiřazeno</option>
              {userId != null && <option value="me">Já</option>}
              {itMembers.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.first_name} {m.last_name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-gray-600">Žadatel</span>
            <select
              value={filters.requester_id}
              onChange={(e) => setFilter("requester_id", e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2"
            >
              <option value="">— Všichni —</option>
              {requesters.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.first_name} {m.last_name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm sm:col-span-2">
            <span className="mb-1 block text-gray-600">Hledat</span>
            <input
              type="search"
              value={draftQ}
              onChange={(e) => setDraftQ(e.target.value)}
              placeholder="Číslo, předmět, žadatel…"
              className="w-full rounded-lg border border-gray-300 px-3 py-2"
            />
          </label>
          <div className="flex flex-wrap items-end gap-2">
            <button
              type="submit"
              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
            >
              Filtrovat
            </button>
            <button
              type="button"
              onClick={resetFilters}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
            >
              Reset
            </button>
          </div>
        </div>
      </form>

      {error && (
        <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>
      )}

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-gray-200 bg-gray-50 text-xs uppercase text-gray-500">
              <tr>
                <th className="px-3 py-2 font-medium">Číslo</th>
                <th className="px-3 py-2 font-medium">Předmět</th>
                <th className="px-3 py-2 font-medium">Žadatel</th>
                <th className="px-3 py-2 font-medium">Řešitel</th>
                <th className="px-3 py-2 font-medium">Kategorie</th>
                <th className="px-3 py-2 font-medium">Priorita</th>
                <th className="px-3 py-2 font-medium">Stav</th>
                <th className="px-3 py-2 font-medium">Vytvořeno</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-3 py-8 text-center text-gray-500">
                    Načítám…
                  </td>
                </tr>
              ) : tickets.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-3 py-8 text-center text-gray-500">
                    Žádné tickety pro zvolené filtry.
                  </td>
                </tr>
              ) : (
                tickets.map((t) => (
                  <Fragment key={t.id}>
                    <tr
                      onClick={() => toggleRow(t.id)}
                      className={`cursor-pointer border-b border-gray-100 hover:bg-gray-50 ${
                        expandedId === t.id ? "bg-red-50/40" : ""
                      }`}
                    >
                      <td className="whitespace-nowrap px-3 py-2 font-mono text-xs text-gray-500">
                        {t.ticket_number}
                      </td>
                      <td className="max-w-[16rem] truncate px-3 py-2 font-medium text-gray-900">
                        {t.subject}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-gray-700">
                        {personName(t.users_requester)}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-gray-700">
                        {personName(t.users_assigned)}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-gray-600">
                        {HELPDESK_CATEGORY_LABELS[t.category] ?? t.category}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-gray-600">
                        {HELPDESK_PRIORITY_LABELS[t.priority] ?? t.priority}
                      </td>
                      <td className="px-3 py-2">
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${HELPDESK_STATUS_BADGE[t.status] ?? "bg-gray-100"}`}
                        >
                          {HELPDESK_STATUS_LABELS[t.status] ?? t.status}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-xs text-gray-500">
                        {new Date(t.created_at).toLocaleString("cs-CZ")}
                      </td>
                    </tr>
                    {expandedId === t.id && (
                      <tr className="border-b border-gray-200 bg-gray-50">
                        <td colSpan={8} className="px-4 py-4">
                          {detailLoading ? (
                            <p className="text-sm text-gray-500">Načítám detail…</p>
                          ) : detail && detail.id === t.id ? (
                            <div className="space-y-4">
                              <p className="text-sm whitespace-pre-wrap text-gray-700">
                                {detail.description}
                              </p>

                              {detail.resolution_note && (
                                <div className="rounded-lg bg-green-50 p-3 text-sm">
                                  <p className="font-medium text-green-900">Řešení</p>
                                  <p className="text-green-800">{detail.resolution_note}</p>
                                </div>
                              )}

                              <HelpdeskAttachmentsPanel
                                ticketId={detail.id}
                                canUpload={canUploadAttachments}
                                canDelete={canUploadAttachments}
                              />

                              {detail.comments.length > 0 && (
                                <div className="space-y-2">
                                  <p className="text-sm font-medium text-gray-900">Komentáře</p>
                                  {detail.comments.map((c) => (
                                    <div
                                      key={c.id}
                                      className={`rounded-lg p-3 text-sm ${c.is_internal ? "bg-amber-50" : "bg-white"}`}
                                    >
                                      <p className="text-xs text-gray-500">
                                        {c.users.first_name} {c.users.last_name}
                                        {c.is_internal && " · interní"} ·{" "}
                                        {new Date(c.created_at).toLocaleString("cs-CZ")}
                                      </p>
                                      <p className="mt-1 whitespace-pre-wrap text-gray-800">
                                        {c.body}
                                      </p>
                                      <HelpdeskAttachmentsPanel
                                        ticketId={detail.id}
                                        commentId={c.id}
                                        canUpload={false}
                                        canDelete={canUploadAttachments}
                                        compact
                                      />
                                    </div>
                                  ))}
                                </div>
                              )}

                              {detail.status !== "uzavreno" && (
                                <form onSubmit={handleComment} className="space-y-2">
                                  <textarea
                                    value={commentText}
                                    onChange={(e) => setCommentText(e.target.value)}
                                    rows={2}
                                    placeholder="Napsat komentář…"
                                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                                  />
                                  <HelpdeskPendingFilesPicker
                                    files={pendingCommentFiles}
                                    onChange={setPendingCommentFiles}
                                    label="Přílohy ke komentáři"
                                  />
                                  <label className="flex items-center gap-2 text-sm text-gray-600">
                                    <input
                                      type="checkbox"
                                      checked={internalComment}
                                      onChange={(e) => setInternalComment(e.target.checked)}
                                    />
                                    Interní poznámka (nevidí žadatel)
                                  </label>
                                  <button
                                    type="submit"
                                    disabled={actionLoading || !commentText.trim()}
                                    className="rounded-lg border border-gray-300 px-4 py-1.5 text-sm hover:bg-gray-50 disabled:opacity-50"
                                  >
                                    Odeslat komentář
                                  </button>
                                </form>
                              )}

                              <div className="space-y-3 rounded-lg border border-gray-200 bg-white p-4">
                                <p className="text-sm font-medium text-gray-900">
                                  Správa ticketu (IT)
                                </p>
                                <div className="grid gap-3 sm:grid-cols-2">
                                  <div>
                                    <label className="mb-1 block text-xs text-gray-600">Stav</label>
                                    <select
                                      value={manageForm.status}
                                      onChange={(e) =>
                                        setManageForm({ ...manageForm, status: e.target.value })
                                      }
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
                                    <label className="mb-1 block text-xs text-gray-600">
                                      Přiřazeno
                                    </label>
                                    <select
                                      value={manageForm.assigned_to_id}
                                      onChange={(e) =>
                                        setManageForm({
                                          ...manageForm,
                                          assigned_to_id: e.target.value,
                                        })
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
                                    <label className="mb-1 block text-xs text-gray-600">
                                      Popis řešení
                                    </label>
                                    <textarea
                                      value={manageForm.resolution_note}
                                      onChange={(e) =>
                                        setManageForm({
                                          ...manageForm,
                                          resolution_note: e.target.value,
                                        })
                                      }
                                      rows={2}
                                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                                    />
                                  </div>
                                )}
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
                          ) : (
                            <p className="text-sm text-gray-500">Detail se nepodařilo načíst.</p>
                          )}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-gray-200 px-3 py-2 text-sm text-gray-600">
          <span>
            Celkem {total} · stránka {filters.page} / {totalPages}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={filters.page <= 1 || loading}
              onClick={() => pushFilters({ ...filters, page: filters.page - 1 })}
              className="rounded-lg border border-gray-300 px-3 py-1 hover:bg-gray-50 disabled:opacity-40"
            >
              Předchozí
            </button>
            <button
              type="button"
              disabled={filters.page >= totalPages || loading}
              onClick={() => pushFilters({ ...filters, page: filters.page + 1 })}
              className="rounded-lg border border-gray-300 px-3 py-1 hover:bg-gray-50 disabled:opacity-40"
            >
              Další
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
