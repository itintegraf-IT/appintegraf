"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { UserPlus, RotateCcw } from "lucide-react";

type User = { id: number; first_name: string; last_name: string };

type Props = {
  equipmentId: number;
  status: string | null;
  canAssign: boolean;
  canReturn: boolean;
  assignedTo: { first_name: string; last_name: string } | null;
  assignedAt: string | null;
};

export function EquipmentAssignClient({
  equipmentId,
  status,
  canAssign,
  canReturn,
  assignedTo,
  assignedAt,
}: Props) {
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [showAssignForm, setShowAssignForm] = useState(false);
  const [assignUserId, setAssignUserId] = useState("");
  const [assignNotes, setAssignNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const isAssigned = status === "p_i_azeno" && assignedTo;
  const isAvailable = status === "skladem";

  useEffect(() => {
    if (canAssign && showAssignForm) {
      fetch("/api/equipment/users")
        .then((r) => r.json())
        .then((data) => (Array.isArray(data) ? setUsers(data) : setUsers([])))
        .catch(() => setUsers([]));
    }
  }, [canAssign, showAssignForm]);

  const handleAssign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignUserId) return;
    setError("");
    setLoading(true);
    try {
      const res = await fetch(`/api/equipment/${equipmentId}/assign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: parseInt(assignUserId, 10), notes: assignNotes || undefined }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Chyba při přiřazování");
        setLoading(false);
        return;
      }
      setShowAssignForm(false);
      setAssignUserId("");
      setAssignNotes("");
      router.refresh();
    } catch {
      setError("Chyba při přiřazování");
    }
    setLoading(false);
  };

  const handleReturn = async () => {
    if (!confirm("Opravdu chcete vrátit toto vybavení?")) return;
    setError("");
    setLoading(true);
    try {
      const res = await fetch(`/api/equipment/${equipmentId}/return`, {
        method: "POST",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Chyba při vracení");
        setLoading(false);
        return;
      }
      router.refresh();
    } catch {
      setError("Chyba při vracení");
    }
    setLoading(false);
  };

  const formatDate = (s: string | null) =>
    s ? new Date(s).toLocaleDateString("cs-CZ", { dateStyle: "medium" }) : "-";

  if (!canAssign && !canReturn && !isAssigned) return null;

  return (
    <div className="mt-6 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      <h3 className="mb-4 text-lg font-semibold text-gray-900">Přiřazení</h3>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>
      )}

      {isAssigned && (
        <div className="mb-4 rounded-lg bg-amber-50 p-4">
          <p className="text-sm text-gray-700">
            <span className="font-medium">Přiřazeno:</span>{" "}
            {assignedTo ? `${assignedTo.first_name} ${assignedTo.last_name}` : "-"}
          </p>
          {assignedAt && (
            <p className="mt-1 text-sm text-gray-500">Od: {formatDate(assignedAt)}</p>
          )}
        </div>
      )}

      {isAssigned && canReturn && (
        <button
          type="button"
          onClick={handleReturn}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-lg bg-amber-600 px-4 py-2 font-medium text-white hover:bg-amber-700 disabled:opacity-50"
        >
          <RotateCcw className="h-4 w-4" />
          {loading ? "Vracím…" : "Vrátit vybavení"}
        </button>
      )}

      {isAvailable && canAssign && !showAssignForm && (
        <button
          type="button"
          onClick={() => setShowAssignForm(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 font-medium text-white hover:bg-red-700"
        >
          <UserPlus className="h-4 w-4" />
          Přiřadit uživateli
        </button>
      )}

      {isAvailable && canAssign && showAssignForm && (
        <form onSubmit={handleAssign} className="mt-4 space-y-4 rounded-lg border border-gray-200 bg-gray-50 p-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Uživatel *</label>
            <select
              required
              value={assignUserId}
              onChange={(e) => setAssignUserId(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2"
            >
              <option value="">Vyberte uživatele</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.last_name} {u.first_name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Poznámka (volitelné)</label>
            <textarea
              value={assignNotes}
              onChange={(e) => setAssignNotes(e.target.value)}
              rows={2}
              className="w-full rounded-lg border border-gray-300 px-3 py-2"
              placeholder="Poznámka k přiřazení…"
            />
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={loading || !assignUserId}
              className="rounded-lg bg-red-600 px-4 py-2 font-medium text-white hover:bg-red-700 disabled:opacity-50"
            >
              {loading ? "Přiřazuji…" : "Přiřadit"}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowAssignForm(false);
                setAssignUserId("");
                setAssignNotes("");
                setError("");
              }}
              className="rounded-lg border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-100"
            >
              Zrušit
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
