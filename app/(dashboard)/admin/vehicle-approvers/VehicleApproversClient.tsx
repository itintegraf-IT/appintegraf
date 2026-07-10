"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type User = { id: number; first_name: string; last_name: string };

type Config = {
  id: number;
  primary_user_id: number;
  secondary_user_id: number | null;
  tertiary_user_id: number | null;
  users_primary: User;
  users_secondary: User | null;
  users_tertiary: User | null;
} | null;

type FormState = {
  primary_user_id: string;
  secondary_user_id: string;
  tertiary_user_id: string;
};

function emptyForm(): FormState {
  return { primary_user_id: "", secondary_user_id: "", tertiary_user_id: "" };
}

function formFromConfig(config: Config): FormState {
  if (!config) return emptyForm();
  return {
    primary_user_id: String(config.primary_user_id),
    secondary_user_id: config.secondary_user_id ? String(config.secondary_user_id) : "",
    tertiary_user_id: config.tertiary_user_id ? String(config.tertiary_user_id) : "",
  };
}

function userLabel(u: User) {
  return `${u.first_name} ${u.last_name}`;
}

export function VehicleApproversClient({ config }: { config: Config }) {
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [form, setForm] = useState<FormState>(formFromConfig(config));
  const [editing, setEditing] = useState(!config);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/admin/users")
      .then((r) => r.json())
      .then((data) => setUsers(data.users ?? []))
      .catch(() => {});
  }, []);

  const vehicleManagers = users.filter(() => true);

  const save = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/vehicle-approvers", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Uložení se nezdařilo");
        return;
      }
      setEditing(false);
      router.refresh();
    } catch {
      setError("Chyba při ukládání");
    } finally {
      setLoading(false);
    }
  };

  const selectField = (label: string, field: keyof FormState, required?: boolean) => (
    <label className="block text-sm">
      <span className="font-medium text-gray-700">
        {label}
        {required ? " *" : ""}
      </span>
      <select
        value={form[field]}
        onChange={(e) => setForm((f) => ({ ...f, [field]: e.target.value }))}
        disabled={!editing}
        className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 disabled:bg-gray-50"
      >
        <option value="">{required ? "— vyberte —" : "— nepřiřazeno —"}</option>
        {vehicleManagers.map((u) => (
          <option key={u.id} value={u.id}>
            {userLabel(u)}
          </option>
        ))}
      </select>
    </label>
  );

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      <p className="mb-4 text-sm text-gray-600">
        Správci vozidel musí mít roli <strong>Správa vozidel</strong>. Při nepřítomnosti se
        použije sekundární a terciární správce.
      </p>

      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}

      {!editing && config && (
        <dl className="mb-4 space-y-2 text-sm">
          <div>
            <dt className="text-gray-500">Primární</dt>
            <dd className="font-medium">{userLabel(config.users_primary)}</dd>
          </div>
          {config.users_secondary && (
            <div>
              <dt className="text-gray-500">Sekundární</dt>
              <dd className="font-medium">{userLabel(config.users_secondary)}</dd>
            </div>
          )}
          {config.users_tertiary && (
            <div>
              <dt className="text-gray-500">Terciární</dt>
              <dd className="font-medium">{userLabel(config.users_tertiary)}</dd>
            </div>
          )}
        </dl>
      )}

      {editing && (
        <div className="grid gap-3 sm:grid-cols-3">
          {selectField("Primární správce", "primary_user_id", true)}
          {selectField("Sekundární správce", "secondary_user_id")}
          {selectField("Terciární správce", "tertiary_user_id")}
        </div>
      )}

      <div className="mt-4 flex gap-2">
        {editing ? (
          <>
            <button
              type="button"
              onClick={save}
              disabled={loading}
              className="rounded-lg bg-red-600 px-4 py-2 text-sm text-white hover:bg-red-700 disabled:opacity-50"
            >
              {loading ? "Ukládám…" : "Uložit"}
            </button>
            {config && (
              <button
                type="button"
                onClick={() => {
                  setEditing(false);
                  setForm(formFromConfig(config));
                }}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
              >
                Zrušit
              </button>
            )}
          </>
        ) : (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm text-white hover:bg-red-700"
          >
            Upravit
          </button>
        )}
      </div>
    </div>
  );
}
