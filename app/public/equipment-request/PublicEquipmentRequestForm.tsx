"use client";

import Link from "next/link";
import { useState } from "react";

export function PublicEquipmentRequestForm({ showInternalLink = false }: { showInternalLink?: boolean }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [form, setForm] = useState({
    requester_name: "",
    requester_email: "",
    requester_phone: "",
    department: "",
    position: "",
    equipment_type: "",
    description: "",
    priority: "st_edn_",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);

    try {
      const res = await fetch("/api/public/equipment-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data.error ?? "Chyba při odesílání");
        setLoading(false);
        return;
      }

      setSuccess(data.message ?? "Požadavek úspěšně odeslán!");
      setForm({
        requester_name: "",
        requester_email: "",
        requester_phone: "",
        department: "",
        position: "",
        equipment_type: "",
        description: "",
        priority: "st_edn_",
      });
    } catch {
      setError("Chyba při odesílání");
    }
    setLoading(false);
  };

  return (
    <>
      {showInternalLink && (
        <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">
          Jste přihlášeni. Pro předvyplněný formulář a přehled požadavků použijte{" "}
          <Link href="/pozadavky" className="font-medium underline">
            interní stránku IT požadavků
          </Link>
          .
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm"
      >
        {error && (
          <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>
        )}
        {success && (
          <div className="mb-4 rounded-lg bg-green-50 p-3 text-sm text-green-700">{success}</div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Jméno *</label>
            <input
              type="text"
              required
              value={form.requester_name}
              onChange={(e) => setForm({ ...form, requester_name: e.target.value })}
              className="w-full rounded-lg border border-gray-300 px-3 py-2"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">E-mail *</label>
            <input
              type="email"
              required
              value={form.requester_email}
              onChange={(e) => setForm({ ...form, requester_email: e.target.value })}
              className="w-full rounded-lg border border-gray-300 px-3 py-2"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Telefon</label>
            <input
              type="tel"
              value={form.requester_phone}
              onChange={(e) => setForm({ ...form, requester_phone: e.target.value })}
              className="w-full rounded-lg border border-gray-300 px-3 py-2"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Oddělení</label>
            <input
              type="text"
              value={form.department}
              onChange={(e) => setForm({ ...form, department: e.target.value })}
              className="w-full rounded-lg border border-gray-300 px-3 py-2"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Pozice</label>
            <input
              type="text"
              value={form.position}
              onChange={(e) => setForm({ ...form, position: e.target.value })}
              className="w-full rounded-lg border border-gray-300 px-3 py-2"
            />
          </div>
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
            <label className="mb-1 block text-sm font-medium text-gray-700">Popis požadavku *</label>
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
    </>
  );
}
