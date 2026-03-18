"use client";

import { useState, useEffect } from "react";
import { Send, Check, X, ChevronDown } from "lucide-react";

const STATUS_LABELS: Record<string, string> = {
  nov_: "Nový",
  cek_na_schv_len_: "Čeká na schválení",
  schv_leno: "Schváleno",
  zam_tnuto: "Zamítnuto",
  odlo_eno: "Odloženo",
  vy__zeno: "Vyřízeno",
};

const PRIORITY_LABELS: Record<string, string> = {
  n_zk_: "Nízká",
  st_edn_: "Střední",
  vysok_: "Vysoká",
};

type Request = {
  id: number;
  requester_name: string;
  requester_email: string;
  equipment_type: string;
  description: string;
  priority: string;
  status: string;
  it_response: string | null;
  admin_response: string | null;
  created_at: string;
  it_response_at: string | null;
  approval_requested_at: string | null;
  users_it: { id: number; first_name: string; last_name: string } | null;
  users_approval: { id: number; first_name: string; last_name: string } | null;
  approval_requested_to: number | null;
};

type Member = { id: number; first_name: string; last_name: string; email: string };

export function EquipmentRequestsTab() {
  const [requests, setRequests] = useState<Request[]>([]);
  const [statusFilter, setStatusFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);
  const [inIT, setInIT] = useState(false);
  const [vedeniMembers, setVedeniMembers] = useState<Member[]>([]);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [itForm, setItForm] = useState<{ id: number; response: string; approvalTo: number } | null>(null);
  const [approveForm, setApproveForm] = useState<{ id: number; action: "approve" | "reject"; response: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const safeJson = async (r: Response) => {
    const text = await r.text();
    if (!text?.trim()) return {};
    try {
      return JSON.parse(text);
    } catch {
      return {};
    }
  };

  const fetchRequests = () => {
    setLoading(true);
    const params = statusFilter !== "all" ? `?status=${statusFilter}` : "";
    fetch(`/api/equipment/requests${params}`)
      .then((r) => safeJson(r))
      .then((data) => {
        setRequests(data.requests ?? []);
      })
      .catch(() => setRequests([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchRequests();
  }, [statusFilter]);

  useEffect(() => {
    fetch("/api/profile")
      .then((r) => safeJson(r))
      .then((data) => setCurrentUserId(data?.id ?? null))
      .catch(() => {});
    fetch("/api/departments/check?name=IT")
      .then((r) => safeJson(r))
      .then((data) => setInIT(data.inDepartment ?? false))
      .catch(() => {});
    fetch(`/api/departments/${encodeURIComponent("Vedení")}/members`)
      .then((r) => safeJson(r))
      .then((data) => setVedeniMembers(data.members ?? []))
      .catch(() => setVedeniMembers([]));
  }, []);

  const handleItSubmit = async () => {
    if (!itForm) return;
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch(`/api/equipment/requests/${itForm.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          it_response: itForm.response,
          approval_requested_to: itForm.approvalTo,
        }),
      });
      const data = await safeJson(res);
      if (!res.ok) {
        setError(data.error ?? "Chyba při odesílání");
        return;
      }
      setItForm(null);
      setExpandedId(null);
      fetchRequests();
    } catch {
      setError("Chyba při odesílání");
    } finally {
      setSubmitting(false);
    }
  };

  const handleApproveSubmit = async () => {
    if (!approveForm) return;
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch(`/api/equipment/requests/${approveForm.id}/approve`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: approveForm.action,
          admin_response: approveForm.response || undefined,
        }),
      });
      const data = await safeJson(res);
      if (!res.ok) {
        setError(data.error ?? "Chyba při odesílání");
        return;
      }
      setApproveForm(null);
      setExpandedId(null);
      fetchRequests();
    } catch {
      setError("Chyba při odesílání");
    } finally {
      setSubmitting(false);
    }
  };

  const formatDate = (s: string | null) =>
    s ? new Date(s).toLocaleDateString("cs-CZ", { dateStyle: "short" }) : "-";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <span>Filtr:</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="all">Všechny</option>
            <option value="nov_">Nové</option>
            <option value="cek_na_schv_len_">Čekající na schválení</option>
            <option value="schv_leno">Schválené</option>
            <option value="zam_tnuto">Zamítnuté</option>
            <option value="odlo_eno">Odložené</option>
            <option value="vy__zeno">Vyřízené</option>
          </select>
        </label>
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>
      )}

      {loading ? (
        <div className="py-12 text-center text-gray-500">Načítání…</div>
      ) : requests.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white p-12 text-center text-gray-500">
          Žádné požadavky
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {requests.map((r) => (
            <div
              key={r.id}
              className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden"
            >
              <div className="border-b border-gray-100 bg-gray-50 px-4 py-3 flex items-center justify-between">
                <span className="font-semibold text-gray-900">#{r.id}</span>
                <span
                  className={`rounded px-2 py-0.5 text-xs font-medium ${
                    r.status === "nov_"
                      ? "bg-amber-100 text-amber-800"
                      : r.status === "cek_na_schv_len_"
                      ? "bg-blue-100 text-blue-800"
                      : r.status === "schv_leno"
                      ? "bg-green-100 text-green-800"
                      : r.status === "zam_tnuto"
                      ? "bg-red-100 text-red-800"
                      : "bg-gray-100 text-gray-700"
                  }`}
                >
                  {STATUS_LABELS[r.status] ?? r.status}
                </span>
              </div>
              <div className="p-4 space-y-2">
                <p className="text-sm">
                  <span className="text-gray-500">Žadatel:</span> {r.requester_name}
                </p>
                <p className="text-sm">
                  <span className="text-gray-500">Typ:</span> {r.equipment_type}
                </p>
                <p className="text-sm">
                  <span className="text-gray-500">Priorita:</span>{" "}
                  {PRIORITY_LABELS[r.priority] ?? r.priority}
                </p>
                <p className="text-sm text-gray-600 line-clamp-2">{r.description}</p>
                <p className="text-xs text-gray-400">{formatDate(r.created_at)}</p>
              </div>
              <div className="border-t border-gray-100 px-4 py-2 text-sm text-gray-500">
                {r.it_response && (
                  <p>
                    IT: {r.users_it ? `${r.users_it.first_name} ${r.users_it.last_name}` : ""} –{" "}
                    {formatDate(r.it_response_at)}
                  </p>
                )}
                {r.approval_requested_to && r.users_approval && (
                  <p>
                    Odesláno: {r.users_approval.first_name} {r.users_approval.last_name}
                  </p>
                )}
              </div>
              <div className="border-t border-gray-100 p-3 bg-gray-50">
                <button
                  onClick={() =>
                    setExpandedId(expandedId === r.id ? null : r.id)
                  }
                  className="flex w-full items-center justify-center gap-1 text-sm text-gray-600 hover:text-gray-900"
                >
                  <ChevronDown
                    className={`h-4 w-4 transition-transform ${expandedId === r.id ? "rotate-180" : ""}`}
                  />
                  {expandedId === r.id ? "Skrýt" : "Detail a akce"}
                </button>
              </div>
              {expandedId === r.id && (
                <div className="border-t border-gray-200 bg-white p-4 space-y-4">
                  <div className="text-sm text-gray-700">
                    <p className="font-medium">{r.description}</p>
                    {r.it_response && (
                      <div className="mt-2 rounded bg-gray-50 p-2">
                        <p className="text-gray-500 text-xs">Stanovisko IT:</p>
                        <p>{r.it_response}</p>
                      </div>
                    )}
                    {r.admin_response && (
                      <div className="mt-2 rounded bg-gray-50 p-2">
                        <p className="text-gray-500 text-xs">Stanovisko vedení:</p>
                        <p>{r.admin_response}</p>
                      </div>
                    )}
                  </div>

                  {r.status === "nov_" && inIT && !itForm && (
                    <div>
                      {vedeniMembers.length === 0 ? (
                        <p className="text-sm text-amber-600">
                          Oddělení „Vedení“ nemá žádné členy. Přidejte uživatele do oddělení.
                        </p>
                      ) : (
                      <button
                        onClick={() =>
                          setItForm({
                            id: r.id,
                            response: "",
                            approvalTo: vedeniMembers[0]!.id,
                          })
                        }
                        className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
                      >
                        <Send className="h-4 w-4" />
                        Odeslat stanovisko a odeslat vedení
                      </button>
                      )}
                    </div>
                  )}

                  {itForm?.id === r.id && (
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        handleItSubmit();
                      }}
                      className="space-y-3 rounded-lg border border-blue-200 bg-blue-50/50 p-4"
                    >
                      <p className="text-sm font-medium text-gray-700">
                        Stanovisko IT a odeslání vedení
                      </p>
                      <textarea
                        value={itForm.response}
                        onChange={(e) =>
                          setItForm((f) => f && { ...f, response: e.target.value })
                        }
                        placeholder="Stanovisko IT…"
                        rows={3}
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                        required
                      />
                      <div>
                        <label className="mb-1 block text-xs text-gray-600">
                          Odeslat ke schválení:
                        </label>
                        <select
                          value={itForm.approvalTo}
                          onChange={(e) =>
                            setItForm((f) =>
                              f ? { ...f, approvalTo: parseInt(e.target.value, 10) } : null
                            )
                          }
                          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                        >
                          {vedeniMembers.map((m) => (
                            <option key={m.id} value={m.id}>
                              {m.first_name} {m.last_name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="submit"
                          disabled={submitting || !itForm.response.trim()}
                          className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
                        >
                          Odeslat
                        </button>
                        <button
                          type="button"
                          onClick={() => setItForm(null)}
                          className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                        >
                          Zrušit
                        </button>
                      </div>
                    </form>
                  )}

                  {r.status === "cek_na_schv_len_" &&
                    r.approval_requested_to === currentUserId &&
                    !approveForm && (
                      <div className="flex gap-2">
                        <button
                          onClick={() =>
                            setApproveForm({
                              id: r.id,
                              action: "approve",
                              response: "",
                            })
                          }
                          className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-3 py-2 text-sm font-medium text-white hover:bg-green-700"
                        >
                          <Check className="h-4 w-4" />
                          Schválit
                        </button>
                        <button
                          onClick={() =>
                            setApproveForm({
                              id: r.id,
                              action: "reject",
                              response: "",
                            })
                          }
                          className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700"
                        >
                          <X className="h-4 w-4" />
                          Zamítnout
                        </button>
                      </div>
                    )}

                  {approveForm?.id === r.id && (
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        handleApproveSubmit();
                      }}
                      className="space-y-3 rounded-lg border border-gray-200 bg-gray-50 p-4"
                    >
                      <p className="text-sm font-medium text-gray-700">
                        {approveForm.action === "approve" ? "Schválení" : "Zamítnutí"}
                      </p>
                      <textarea
                        value={approveForm.response}
                        onChange={(e) =>
                          setApproveForm((f) =>
                            f ? { ...f, response: e.target.value } : null
                          )
                        }
                        placeholder="Stanovisko vedení (volitelné)"
                        rows={2}
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                      />
                      <div className="flex gap-2">
                        <button
                          type="submit"
                          disabled={submitting}
                          className="rounded-lg bg-green-600 px-4 py-2 text-sm text-white hover:bg-green-700 disabled:opacity-50"
                        >
                          {approveForm.action === "approve" ? "Schválit" : "Zamítnout"}
                        </button>
                        <button
                          type="button"
                          onClick={() => setApproveForm(null)}
                          className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                        >
                          Zrušit
                        </button>
                      </div>
                    </form>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
