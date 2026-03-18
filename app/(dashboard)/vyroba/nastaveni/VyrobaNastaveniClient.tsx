"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { ArrowLeft, Save, Settings, Plus, Pencil, Trash2, RotateCcw } from "lucide-react";
import { JOB_TYPES, JOB_LABELS } from "@/lib/vyroba/config/fix-settings";

type JobConfigRow = {
  job: string;
  stav: string;
  serie: unknown;
  pocet_cna_roli: number | null;
  ks_v_krabici: number;
  prvni_role: number;
  prvni_jizd: number;
  prod: number;
  skip: number | null;
  predcisli: unknown;
  cislo_zakazky: string | null;
};

type Employee = {
  id: number;
  name: string;
  sort_order: number;
  is_active: boolean;
};

type Props = {
  initialAddress: string;
  initialJobConfigs: Record<string, JobConfigRow>;
  initialEmployees: Employee[];
};

export default function VyrobaNastaveniClient({
  initialAddress,
  initialJobConfigs,
  initialEmployees,
}: Props) {
  const [address, setAddress] = useState(initialAddress);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [employees, setEmployees] = useState<Employee[]>(initialEmployees);
  const [newName, setNewName] = useState("");
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");

  const loadEmployees = useCallback(async () => {
    const res = await fetch("/api/vyroba/employees");
    if (res.ok) {
      const data = await res.json();
      setEmployees(data);
    }
  }, []);

  const saveAddress = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/vyroba/address", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Chyba");
      setMessage({ type: "ok", text: "Adresa uložena" });
    } catch (e) {
      setMessage({ type: "err", text: e instanceof Error ? e.message : "Chyba při ukládání" });
    } finally {
      setSaving(false);
    }
  };

  const handleAddEmployee = async () => {
    if (!newName.trim()) return;
    setAdding(true);
    setMessage(null);
    try {
      const res = await fetch("/api/vyroba/employees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Chyba");
      setNewName("");
      setMessage({ type: "ok", text: "Zaměstnanec přidán" });
      await loadEmployees();
    } catch (e) {
      setMessage({ type: "err", text: e instanceof Error ? e.message : "Chyba" });
    } finally {
      setAdding(false);
    }
  };

  const handleSaveEdit = async (id: number) => {
    if (!editName.trim()) return;
    setMessage(null);
    try {
      const res = await fetch(`/api/vyroba/employees/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editName.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Chyba");
      setEditingId(null);
      setMessage({ type: "ok", text: "Zaměstnanec upraven" });
      await loadEmployees();
    } catch (e) {
      setMessage({ type: "err", text: e instanceof Error ? e.message : "Chyba" });
    }
  };

  const handleDeactivate = async (id: number) => {
    if (!confirm("Opravdu deaktivovat tohoto zaměstnance?")) return;
    setMessage(null);
    try {
      const res = await fetch(`/api/vyroba/employees/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Chyba");
      setMessage({ type: "ok", text: "Zaměstnanec deaktivován" });
      await loadEmployees();
    } catch (e) {
      setMessage({ type: "err", text: e instanceof Error ? e.message : "Chyba" });
    }
  };

  const handleReactivate = async (id: number) => {
    setMessage(null);
    try {
      const res = await fetch(`/api/vyroba/employees/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Chyba");
      setMessage({ type: "ok", text: "Zaměstnanec znovu aktivován" });
      await loadEmployees();
    } catch (e) {
      setMessage({ type: "err", text: e instanceof Error ? e.message : "Chyba" });
    }
  };

  return (
    <>
      <div className="mb-6 flex items-center gap-4">
        <Link
          href="/vyroba"
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Zpět
        </Link>
      </div>

      <div className="mb-8">
        <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900">
          <Settings className="h-7 w-7 text-amber-600" />
          Nastavení výroby
        </h1>
        <p className="mt-1 text-gray-600">
          Konfigurace ADRESA (cesta pro výstupy), JOB parametry a zaměstnanci
        </p>
      </div>

      <div className="space-y-8">
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">ADRESA (cesta výstupů)</h2>
          <p className="mb-3 text-sm text-gray-500">
            Kořenová cesta pro složky TISK a REZANI (např. D:\Sazka\A17144)
          </p>
          <div className="flex gap-3">
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="D:\Sazka\A17144"
              className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
            />
            <button
              onClick={saveAddress}
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-lg bg-amber-600 px-4 py-2 font-medium text-white hover:bg-amber-700 disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
              {saving ? "Ukládám…" : "Uložit"}
            </button>
          </div>
          {message && (
            <p
              className={`mt-2 text-sm ${message.type === "ok" ? "text-green-600" : "text-red-600"}`}
            >
              {message.text}
            </p>
          )}
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">Konfigurace JOB</h2>
          <p className="mb-4 text-sm text-gray-500">
            Konfigurace jednotlivých typů produktů se upravuje v obrazovkách Generování a Kontrola.
          </p>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {JOB_TYPES.map((job) => {
              const cfg = initialJobConfigs[job];
              return (
                <Link
                  key={job}
                  href={`/vyroba/${job}`}
                  className="flex items-center justify-between rounded-lg border border-gray-100 bg-gray-50/50 px-4 py-3 hover:bg-amber-50/50"
                >
                  <div>
                    <p className="font-medium text-gray-900">{JOB_LABELS[job] ?? job}</p>
                    <p className="text-xs text-gray-500">
                      {cfg
                        ? `Serie: ${Array.isArray(cfg.serie) ? cfg.serie.join(", ") : "—"}`
                        : "Výchozí nastavení"}
                    </p>
                  </div>
                  <span className="text-sm text-amber-600">Upravit →</span>
                </Link>
              );
            })}
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">Zaměstnanci (baliči)</h2>
          <p className="mb-4 text-sm text-gray-500">
            Seznam baličů pro protokoly. Neaktivní zaměstnanci se nezobrazují v kontrole.
          </p>

          <div className="mb-4 flex gap-2">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Jméno nového zaměstnance"
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
              onKeyDown={(e) => e.key === "Enter" && handleAddEmployee()}
            />
            <button
              onClick={handleAddEmployee}
              disabled={adding || !newName.trim()}
              className="inline-flex items-center gap-2 rounded-lg bg-amber-600 px-4 py-2 font-medium text-white hover:bg-amber-700 disabled:opacity-50"
            >
              <Plus className="h-4 w-4" />
              {adding ? "Přidávám…" : "Přidat"}
            </button>
          </div>

          {employees.length > 0 ? (
            <div className="overflow-x-auto rounded-lg border border-gray-200">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    <th className="p-3 text-left font-medium">Pořadí</th>
                    <th className="p-3 text-left font-medium">Jméno</th>
                    <th className="p-3 text-left font-medium">Stav</th>
                    <th className="p-3 text-right font-medium">Akce</th>
                  </tr>
                </thead>
                <tbody>
                  {employees.map((e) => (
                    <tr
                      key={e.id}
                      className={`border-b border-gray-100 ${!e.is_active ? "bg-gray-50 text-gray-500" : ""}`}
                    >
                      <td className="p-3">{e.sort_order}</td>
                      <td className="p-3">
                        {editingId === e.id ? (
                          <input
                            type="text"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            className="w-full rounded border border-gray-300 px-2 py-1"
                            autoFocus
                            onKeyDown={(ev) => {
                              if (ev.key === "Enter") handleSaveEdit(e.id);
                              if (ev.key === "Escape") setEditingId(null);
                            }}
                          />
                        ) : (
                          e.name
                        )}
                      </td>
                      <td className="p-3">
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                            e.is_active ? "bg-green-100 text-green-800" : "bg-gray-200 text-gray-600"
                          }`}
                        >
                          {e.is_active ? "Aktivní" : "Neaktivní"}
                        </span>
                      </td>
                      <td className="p-3 text-right">
                        {editingId === e.id ? (
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => handleSaveEdit(e.id)}
                              className="text-green-600 hover:underline"
                            >
                              Uložit
                            </button>
                            <button
                              onClick={() => setEditingId(null)}
                              className="text-gray-500 hover:underline"
                            >
                              Zrušit
                            </button>
                          </div>
                        ) : (
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => {
                                setEditingId(e.id);
                                setEditName(e.name);
                              }}
                              className="rounded p-1 text-amber-600 hover:bg-amber-50"
                              title="Upravit"
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                            {e.is_active ? (
                              <button
                                onClick={() => handleDeactivate(e.id)}
                                className="rounded p-1 text-red-600 hover:bg-red-50"
                                title="Deaktivovat"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            ) : (
                              <button
                                onClick={() => handleReactivate(e.id)}
                                className="rounded p-1 text-green-600 hover:bg-green-50"
                                title="Znovu aktivovat"
                              >
                                <RotateCcw className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-gray-500">Žádní zaměstnanci zatím nejsou zadaní.</p>
          )}
        </div>
      </div>
    </>
  );
}
