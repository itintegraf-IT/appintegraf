"use client";

import { useEffect, useState } from "react";
import { Plus, Save, Trash2, Pencil, X, UserCheck } from "lucide-react";

type PartTimerStatus =
  | "student"
  | "duchodce"
  | "nezamestnany"
  | "zamestnany"
  | "osvc"
  | "materska_rodicovska"
  | "jine";

export type PartTimer = {
  id: number;
  first_name: string;
  last_name: string;
  phone: string | null;
  email: string | null;
  status: PartTimerStatus;
  notes: string | null;
  valid_from: string | null;
  valid_to: string | null;
  position_id: number | null;
  created_at: string;
  updated_at: string;
};

type PartTimerForm = {
  first_name: string;
  last_name: string;
  phone: string;
  email: string;
  status: PartTimerStatus;
  notes: string;
  valid_from: string;
  valid_to: string;
  position_id: number | null;
};

type Position = { id: number; name: string; is_active?: number };

const PART_TIMER_STATUS_LABELS: Record<PartTimerStatus, string> = {
  student: "Student",
  duchodce: "Důchodce",
  nezamestnany: "Nezaměstnaný",
  zamestnany: "Zaměstnaný",
  osvc: "OSVČ",
  materska_rodicovska: "Mateřská/rodičovská",
  jine: "Jiné",
};

const EMPTY_PART_TIMER: PartTimerForm = {
  first_name: "",
  last_name: "",
  phone: "",
  email: "",
  status: "student",
  notes: "",
  valid_from: "",
  valid_to: "",
  position_id: null,
};

export function PersonalistikaPartTimersPanel({
  canWrite,
  positions,
  onError,
  onSuccess,
  onHiredEmployee,
}: {
  canWrite: boolean;
  positions: Position[];
  onError: (msg: string) => void;
  onSuccess: (msg: string) => void;
  onHiredEmployee: (employeeId: number) => void;
}) {
  const [partTimers, setPartTimers] = useState<PartTimer[]>([]);
  const [partTimerQuery, setPartTimerQuery] = useState("");
  const [editingPartTimerId, setEditingPartTimerId] = useState<number | "new" | null>(null);
  const [partTimerForm, setPartTimerForm] = useState<PartTimerForm>(EMPTY_PART_TIMER);
  const [hiringId, setHiringId] = useState<number | null>(null);

  const loadPartTimers = async () => {
    const params = new URLSearchParams();
    if (partTimerQuery) params.set("q", partTimerQuery);
    const res = await fetch(`/api/personalistika/part-timers?${params}`);
    const data = await res.json().catch(() => ({}));
    setPartTimers(data.partTimers ?? []);
  };

  useEffect(() => {
    loadPartTimers();
  }, [partTimerQuery]);

  const startNewPartTimer = () => {
    setEditingPartTimerId("new");
    setPartTimerForm(EMPTY_PART_TIMER);
    onError("");
    onSuccess("");
  };

  const startEditPartTimer = (pt: PartTimer) => {
    setEditingPartTimerId(pt.id);
    setPartTimerForm({
      first_name: pt.first_name,
      last_name: pt.last_name,
      phone: pt.phone ?? "",
      email: pt.email ?? "",
      status: pt.status,
      notes: pt.notes ?? "",
      valid_from: pt.valid_from ?? "",
      valid_to: pt.valid_to ?? "",
      position_id: pt.position_id,
    });
    onError("");
    onSuccess("");
  };

  const cancelPartTimerEdit = () => {
    setEditingPartTimerId(null);
    setPartTimerForm(EMPTY_PART_TIMER);
  };

  const savePartTimer = async () => {
    if (editingPartTimerId === null) return;
    onError("");
    onSuccess("");

    const isNew = editingPartTimerId === "new";
    const url = isNew
      ? "/api/personalistika/part-timers"
      : `/api/personalistika/part-timers/${editingPartTimerId}`;
    const method = isNew ? "POST" : "PUT";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(partTimerForm),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      onError(data.error ?? "Brigádníka se nepodařilo uložit.");
      return;
    }
    onSuccess(isNew ? "Brigádník byl přidán." : "Brigádník byl uložen.");
    cancelPartTimerEdit();
    await loadPartTimers();
  };

  const removePartTimer = async (id: number) => {
    if (!confirm("Smazat brigádníka?")) return;
    onError("");
    onSuccess("");
    const res = await fetch(`/api/personalistika/part-timers/${id}`, { method: "DELETE" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      onError(data.error ?? "Smazání se nezdařilo.");
      return;
    }
    if (editingPartTimerId === id) cancelPartTimerEdit();
    await loadPartTimers();
  };

  const hirePartTimer = async (pt: PartTimer) => {
    if (!pt.email) {
      onError("Pro převod na zaměstnance doplňte e-mail.");
      return;
    }
    if (!confirm(`Převést ${pt.last_name} ${pt.first_name} na zaměstnance? Založí se účet a evidence.`)) {
      return;
    }
    setHiringId(pt.id);
    onError("");
    onSuccess("");
    try {
      const res = await fetch(`/api/personalistika/part-timers/${pt.id}/hire`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employment_type: "thp" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        onError(data.error ?? "Převod se nezdařil.");
        return;
      }
      const mailNote =
        data.activation_emailed === true
          ? " Aktivační e-mail byl odeslán."
          : data.user_created
            ? " Aktivační e-mail se nepodařilo odeslat — nastavte heslo v administraci."
            : " Napojeno na existující účet.";
      onSuccess(`Brigádník byl převeden na zaměstnance #${data.employee_id}.${mailNote}`);
      await loadPartTimers();
      if (data.employee_id) onHiredEmployee(Number(data.employee_id));
    } finally {
      setHiringId(null);
    }
  };

  const positionName = (id: number | null) =>
    id ? positions.find((p) => p.id === id)?.name ?? `#${id}` : "-";

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <p className="mb-4 text-sm text-gray-600">
        Evidence brigádníků / DPP — odděleně od kmenových zaměstnanců. Lze doplnit platnost, pozici a
        převést na zaměstnance.
      </p>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <input
          value={partTimerQuery}
          onChange={(e) => setPartTimerQuery(e.target.value)}
          placeholder="Hledat brigádníka..."
          className="rounded-lg border border-gray-300 px-3 py-2"
        />
        {canWrite && editingPartTimerId !== "new" && (
          <button
            onClick={startNewPartTimer}
            className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
          >
            <Plus className="h-4 w-4" />
            Přidat brigádníka
          </button>
        )}
      </div>

      {editingPartTimerId !== null && canWrite && (
        <div className="mb-4 rounded-lg border border-gray-200 bg-gray-50 p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-800">
              {editingPartTimerId === "new" ? "Nový brigádník" : `Úprava brigádníka #${editingPartTimerId}`}
            </h3>
            <button
              onClick={cancelPartTimerEdit}
              className="inline-flex items-center gap-1 rounded border border-gray-300 px-2 py-1 text-xs"
            >
              <X className="h-3.5 w-3.5" />
              Zrušit
            </button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <input
              value={partTimerForm.first_name}
              onChange={(e) => setPartTimerForm({ ...partTimerForm, first_name: e.target.value })}
              placeholder="Jméno *"
              className="rounded-lg border border-gray-300 px-3 py-2"
            />
            <input
              value={partTimerForm.last_name}
              onChange={(e) => setPartTimerForm({ ...partTimerForm, last_name: e.target.value })}
              placeholder="Příjmení *"
              className="rounded-lg border border-gray-300 px-3 py-2"
            />
            <input
              type="tel"
              value={partTimerForm.phone}
              onChange={(e) => setPartTimerForm({ ...partTimerForm, phone: e.target.value })}
              placeholder="Telefon"
              className="rounded-lg border border-gray-300 px-3 py-2"
            />
            <input
              type="email"
              value={partTimerForm.email}
              onChange={(e) => setPartTimerForm({ ...partTimerForm, email: e.target.value })}
              placeholder="E-mail"
              className="rounded-lg border border-gray-300 px-3 py-2"
            />
            <select
              value={partTimerForm.status}
              onChange={(e) =>
                setPartTimerForm({ ...partTimerForm, status: e.target.value as PartTimerStatus })
              }
              className="rounded-lg border border-gray-300 px-3 py-2"
            >
              {Object.entries(PART_TIMER_STATUS_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            <select
              value={partTimerForm.position_id ?? ""}
              onChange={(e) =>
                setPartTimerForm({
                  ...partTimerForm,
                  position_id: e.target.value ? parseInt(e.target.value, 10) : null,
                })
              }
              className="rounded-lg border border-gray-300 px-3 py-2"
            >
              <option value="">— Bez pozice —</option>
              {positions
                .filter((p) => p.is_active !== 0)
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
            </select>
            <input
              type="date"
              value={partTimerForm.valid_from}
              onChange={(e) => setPartTimerForm({ ...partTimerForm, valid_from: e.target.value })}
              className="rounded-lg border border-gray-300 px-3 py-2"
              title="Platnost od"
            />
            <input
              type="date"
              value={partTimerForm.valid_to}
              onChange={(e) => setPartTimerForm({ ...partTimerForm, valid_to: e.target.value })}
              className="rounded-lg border border-gray-300 px-3 py-2"
              title="Platnost do"
            />
            <textarea
              value={partTimerForm.notes}
              onChange={(e) => setPartTimerForm({ ...partTimerForm, notes: e.target.value })}
              placeholder="Poznámka"
              rows={3}
              className="rounded-lg border border-gray-300 px-3 py-2 sm:col-span-2"
            />
          </div>
          <div className="mt-3">
            <button
              onClick={savePartTimer}
              className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
            >
              <Save className="h-4 w-4" />
              Uložit
            </button>
          </div>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="border-b border-gray-200 bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Jméno a příjmení</th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Kontakt</th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Pozice</th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Platnost</th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Stav</th>
              {canWrite && <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">Akce</th>}
            </tr>
          </thead>
          <tbody>
            {partTimers.length === 0 ? (
              <tr>
                <td colSpan={canWrite ? 6 : 5} className="px-4 py-8 text-center text-gray-500">
                  Zatím žádní brigádníci
                </td>
              </tr>
            ) : (
              partTimers.map((pt) => (
                <tr key={pt.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">
                    {pt.last_name} {pt.first_name}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <div>{pt.phone || "-"}</div>
                    <div className="text-xs text-gray-500">{pt.email || "-"}</div>
                  </td>
                  <td className="px-4 py-3 text-sm">{positionName(pt.position_id)}</td>
                  <td className="px-4 py-3 text-sm">
                    {pt.valid_from || pt.valid_to
                      ? `${pt.valid_from || "?"} – ${pt.valid_to || "?"}`
                      : "-"}
                  </td>
                  <td className="px-4 py-3 text-sm">{PART_TIMER_STATUS_LABELS[pt.status]}</td>
                  {canWrite && (
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex flex-wrap justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => hirePartTimer(pt)}
                          disabled={hiringId === pt.id}
                          className="inline-flex items-center gap-1 rounded border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs text-emerald-800 disabled:opacity-60"
                        >
                          <UserCheck className="h-3.5 w-3.5" />
                          {hiringId === pt.id ? "Převádím…" : "Na zaměstnance"}
                        </button>
                        <button
                          type="button"
                          onClick={() => startEditPartTimer(pt)}
                          className="inline-flex items-center gap-1 rounded border border-gray-300 px-2 py-1 text-xs"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          Upravit
                        </button>
                        <button
                          type="button"
                          onClick={() => removePartTimer(pt.id)}
                          className="inline-flex items-center gap-1 rounded border border-red-200 bg-red-50 px-2 py-1 text-xs text-red-700"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Smazat
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
