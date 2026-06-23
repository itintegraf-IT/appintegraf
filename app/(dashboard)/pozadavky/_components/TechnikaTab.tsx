"use client";

import { useState, useEffect, useCallback } from "react";
import {
  EQUIPMENT_PRIORITY_LABELS,
  EQUIPMENT_STATUS_BADGE,
  EQUIPMENT_STATUS_LABELS,
} from "@/lib/equipment-request-labels";
import { safeJson } from "@/lib/safe-json-response";

type UserProfile = {
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  department_name: string | null;
  position: string | null;
};

type EquipmentRequest = {
  id: number;
  equipment_type: string;
  description: string;
  priority: string;
  status: string;
  it_response: string | null;
  admin_response: string | null;
  created_at: string;
  users_it: { first_name: string; last_name: string } | null;
};

export function TechnikaTab({ profile }: { profile: UserProfile }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [requests, setRequests] = useState<EquipmentRequest[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [form, setForm] = useState({
    equipment_type: "",
    description: "",
    priority: "st_edn_",
  });

  const fetchMine = useCallback(() => {
    setListLoading(true);
    fetch("/api/equipment/requests/mine")
      .then((r) => safeJson(r))
      .then((data) => setRequests((data.requests as EquipmentRequest[]) ?? []))
      .catch(() => setRequests([]))
      .finally(() => setListLoading(false));
  }, []);

  useEffect(() => {
    fetchMine();
  }, [fetchMine]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);

    try {
      const res = await fetch("/api/equipment/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await safeJson(res);

      if (!res.ok) {
        setError(String(data.error ?? "Chyba při odesílání"));
        setLoading(false);
        return;
      }

      setSuccess(String(data.message ?? "Požadavek odeslán"));
      setForm({ equipment_type: "", description: "", priority: "st_edn_" });
      fetchMine();
    } catch {
      setError("Chyba při odesílání");
    }
    setLoading(false);
  };

  const fullName = `${profile.first_name} ${profile.last_name}`.trim();

  return (
    <div className="space-y-8">
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">Nový požadavek na techniku</h2>

        <div className="mb-6 rounded-lg bg-gray-50 p-4 text-sm text-gray-700">
          <p className="font-medium text-gray-900">{fullName}</p>
          <p>{profile.email}</p>
          {profile.phone && <p>{profile.phone}</p>}
          {(profile.department_name || profile.position) && (
            <p>
              {[profile.department_name, profile.position].filter(Boolean).join(" · ")}
            </p>
          )}
        </div>

        <form onSubmit={handleSubmit}>
          {error && (
            <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>
          )}
          {success && (
            <div className="mb-4 rounded-lg bg-green-50 p-3 text-sm text-green-700">{success}</div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Typ vybavení *
              </label>
              <input
                type="text"
                required
                value={form.equipment_type}
                onChange={(e) => setForm({ ...form, equipment_type: e.target.value })}
                placeholder="např. notebook, monitor"
                className="w-full rounded-lg border border-gray-300 px-3 py-2"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Priorita</label>
              <select
                value={form.priority}
                onChange={(e) => setForm({ ...form, priority: e.target.value })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2"
              >
                <option value="n_zk_">Nízká</option>
                <option value="st_edn_">Střední</option>
                <option value="vysok_">Vysoká</option>
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Popis požadavku *
              </label>
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
              disabled={loading}
              className="rounded-lg bg-red-600 px-6 py-2 font-medium text-white hover:bg-red-700 disabled:opacity-50"
            >
              {loading ? "Odesílám…" : "Odeslat požadavek"}
            </button>
          </div>
        </form>
      </div>

      <div>
        <h2 className="mb-4 text-lg font-semibold text-gray-900">Moje požadavky</h2>
        {listLoading ? (
          <p className="text-sm text-gray-500">Načítám…</p>
        ) : requests.length === 0 ? (
          <p className="text-sm text-gray-500">Zatím nemáte žádné požadavky.</p>
        ) : (
          <div className="space-y-3">
            {requests.map((req) => (
              <div
                key={req.id}
                className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <span className="font-medium text-gray-900">#{req.id}</span>
                    <span className="mx-2 text-gray-400">·</span>
                    <span className="text-gray-800">{req.equipment_type}</span>
                  </div>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${EQUIPMENT_STATUS_BADGE[req.status] ?? "bg-gray-100 text-gray-700"}`}
                  >
                    {EQUIPMENT_STATUS_LABELS[req.status] ?? req.status}
                  </span>
                </div>
                <p className="mt-2 text-sm text-gray-600">{req.description}</p>
                <p className="mt-2 text-xs text-gray-500">
                  Priorita: {EQUIPMENT_PRIORITY_LABELS[req.priority] ?? req.priority} ·{" "}
                  {new Date(req.created_at).toLocaleString("cs-CZ")}
                </p>
                {req.it_response && (
                  <div className="mt-3 rounded-lg bg-blue-50 p-3 text-sm">
                    <p className="font-medium text-blue-900">Stanovisko IT</p>
                    <p className="text-blue-800">{req.it_response}</p>
                  </div>
                )}
                {req.admin_response && (
                  <div className="mt-3 rounded-lg bg-gray-50 p-3 text-sm">
                    <p className="font-medium text-gray-900">Rozhodnutí vedení</p>
                    <p className="text-gray-700">{req.admin_response}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
