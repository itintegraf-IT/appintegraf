"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import type { ResourceType } from "@/lib/resource-reservation-types";
import { formatDateTimeLocalForInput } from "../../lib/week-utils";

type Props = {
  open: boolean;
  onClose: () => void;
  resourceId: number;
  resourceName: string;
  resourceType: ResourceType;
  initialStart: Date;
  initialEnd: Date;
};

export function ResourceBookingModal({
  open,
  onClose,
  resourceId,
  resourceName,
  resourceType,
  initialStart,
  initialEnd,
}: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    title: "",
    purpose: "",
    description: "",
    start_date: formatDateTimeLocalForInput(initialStart),
    end_date: formatDateTimeLocalForInput(initialEnd),
  });

  if (!open) return null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/calendar/reservations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resource_id: resourceId,
          title: form.title.trim() || `Rezervace – ${resourceName}`,
          purpose: form.purpose.trim() || null,
          description: form.description.trim() || null,
          start_date: new Date(form.start_date).toISOString(),
          end_date: new Date(form.end_date).toISOString(),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Rezervace se nezdařila");
        return;
      }
      onClose();
      router.refresh();
      if (resourceType === "vehicle" && data.reservation?.id) {
        router.push(`/calendar/resources/vehicles/${data.reservation.id}`);
      }
    } catch {
      setError("Chyba při odesílání");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-6 shadow-lg">
        <div className="mb-4 flex items-start justify-between gap-2">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">
              Rezervace – {resourceName}
            </h3>
            <p className="text-sm text-gray-600">
              {resourceType === "room"
                ? "Místnost bude rezervována okamžitě, pokud je volná."
                : "Rezervace auta vyžaduje schválení správcem vozidel."}
            </p>
          </div>
          <button type="button" onClick={onClose} className="rounded p-1 text-gray-500 hover:bg-gray-100">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={submit} className="space-y-3">
          <label className="block text-sm">
            <span className="font-medium text-gray-700">Název / účel *</span>
            <input
              required
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
              placeholder="Schůzka, cesta…"
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium text-gray-700">Od</span>
            <input
              type="datetime-local"
              required
              value={form.start_date}
              onChange={(e) => setForm((f) => ({ ...f, start_date: e.target.value }))}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium text-gray-700">Do</span>
            <input
              type="datetime-local"
              required
              value={form.end_date}
              onChange={(e) => setForm((f) => ({ ...f, end_date: e.target.value }))}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium text-gray-700">Poznámka</span>
            <textarea
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              rows={3}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
            />
          </label>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50"
            >
              Zrušit
            </button>
            <button
              type="submit"
              disabled={loading}
              className="rounded-lg bg-red-600 px-4 py-2 text-white hover:bg-red-700 disabled:opacity-50"
            >
              {loading ? "Ukládám…" : "Rezervovat"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
