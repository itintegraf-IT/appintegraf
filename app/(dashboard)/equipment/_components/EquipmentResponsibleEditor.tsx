"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type UserOpt = { id: number; first_name: string; last_name: string };

function personLabel(u: { first_name: string; last_name: string } | null | undefined) {
  if (!u) return "";
  return `${u.last_name} ${u.first_name}`.trim();
}

export function EquipmentResponsibleEditor({
  categoryId,
  categoryName,
  currentUserId,
  currentPerson,
  canEdit,
}: {
  categoryId: number;
  categoryName: string;
  currentUserId: number | null;
  currentPerson: { first_name: string; last_name: string } | null;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [users, setUsers] = useState<UserOpt[]>([]);
  const [value, setValue] = useState(currentUserId != null ? String(currentUserId) : "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setValue(currentUserId != null ? String(currentUserId) : "");
  }, [currentUserId]);

  useEffect(() => {
    if (!canEdit) return;
    fetch("/api/equipment/users")
      .then((r) => r.json())
      .then((d) => setUsers(Array.isArray(d) ? d : []))
      .catch(() => undefined);
  }, [canEdit]);

  const save = async (next: string) => {
    setError("");
    setValue(next);
    setSaving(true);
    try {
      const res = await fetch(`/api/equipment/categories/${categoryId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ responsible_user_id: next === "" ? null : parseInt(next, 10) }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Uložení se nezdařilo");
        return;
      }
      router.refresh();
    } catch {
      setError("Uložení se nezdařilo");
    } finally {
      setSaving(false);
    }
  };

  const shown = personLabel(currentPerson) || "— Bez zodpovědné osoby";

  if (!canEdit) {
    return (
      <div>
        <p className="text-sm text-gray-500">Zodpovědná osoba (skupina)</p>
        <p className="font-medium">{shown}</p>
      </div>
    );
  }

  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-gray-700">
        Zodpovědná osoba (skupina)
      </label>
      <select
        value={value}
        disabled={saving}
        onChange={(e) => void save(e.target.value)}
        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
      >
        <option value="">— Bez zodpovědné osoby —</option>
        {users.map((u) => (
          <option key={u.id} value={u.id}>
            {personLabel(u)}
          </option>
        ))}
      </select>
      <p className="mt-1 text-xs text-gray-500">
        Platí pro celou skupinu {categoryName} (není to totéž co držitel položky).
        Odebrání = prázdná volba.
      </p>
      {error ? <p className="mt-1 text-xs text-red-600">{error}</p> : null}
    </div>
  );
}
