"use client";

import { useState, useEffect } from "react";
import { User, Mail, Phone } from "lucide-react";

type ProfileData = {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  phone: string | null;
  landline: string | null;
  landline2: string | null;
  position: string | null;
  department_name: string | null;
  last_login: string | null;
  created_at: string;
};

export default function ProfilePage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    landline: "",
    landline2: "",
    position: "",
    password_current: "",
    password_new: "",
  });

  useEffect(() => {
    fetch("/api/profile")
      .then((r) => r.json())
      .then((data) => {
        if (data?.id) {
          setProfile(data);
          setForm({
            first_name: data.first_name ?? "",
            last_name: data.last_name ?? "",
            email: data.email ?? "",
            phone: data.phone ?? "",
            landline: data.landline ?? "",
            landline2: data.landline2 ?? "",
            position: data.position ?? "",
            password_current: "",
            password_new: "",
          });
        }
      })
      .catch(() => setError("Chyba při načítání"))
      .finally(() => setLoading(false));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess(false);
    setSaving(true);

    try {
      const res = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          password_current: form.password_current || undefined,
          password_new: form.password_new || undefined,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data.error ?? "Chyba při ukládání");
        setSaving(false);
        return;
      }

      setSuccess(true);
      setForm((f) => ({ ...f, password_current: "", password_new: "" }));
    } catch {
      setError("Chyba při ukládání");
    }
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-8 text-center">
        <p className="text-gray-500">Načítání…</p>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6">
        <p className="text-red-700">Profil nenalezen</p>
      </div>
    );
  }

  return (
    <>
      <div className="mb-6">
        <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900">
          <User className="h-7 w-7 text-red-600" />
          Můj profil
        </h1>
        <p className="mt-1 text-gray-600">Úprava osobních údajů</p>
      </div>

      <form onSubmit={handleSubmit} className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        {error && (
          <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>
        )}
        {success && (
          <div className="mb-4 rounded-lg bg-green-50 p-3 text-sm text-green-700">
            Profil byl úspěšně uložen.
          </div>
        )}

        <div className="mb-6 rounded-lg bg-gray-50 p-4">
          <p className="text-sm text-gray-500">Přihlašovací jméno</p>
          <p className="font-medium">{profile.username}</p>
          {profile.department_name && (
            <p className="mt-1 text-sm text-gray-500">Oddělení: {profile.department_name}</p>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Jméno *</label>
            <input
              type="text"
              required
              value={form.first_name}
              onChange={(e) => setForm({ ...form, first_name: e.target.value })}
              className="w-full rounded-lg border border-gray-300 px-3 py-2"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Příjmení *</label>
            <input
              type="text"
              required
              value={form.last_name}
              onChange={(e) => setForm({ ...form, last_name: e.target.value })}
              className="w-full rounded-lg border border-gray-300 px-3 py-2"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">E-mail *</label>
            <input
              type="email"
              required
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
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
            <label className="mb-1 block text-sm font-medium text-gray-700">Mobil</label>
            <input
              type="tel"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              className="w-full rounded-lg border border-gray-300 px-3 py-2"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Pevná linka</label>
            <input
              type="tel"
              value={form.landline}
              onChange={(e) => setForm({ ...form, landline: e.target.value })}
              className="w-full rounded-lg border border-gray-300 px-3 py-2"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Tel. linka 2</label>
            <input
              type="tel"
              value={form.landline2}
              onChange={(e) => setForm({ ...form, landline2: e.target.value })}
              className="w-full rounded-lg border border-gray-300 px-3 py-2"
            />
          </div>
        </div>

        <div className="mt-8 border-t border-gray-200 pt-6">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">Změna hesla</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Současné heslo
              </label>
              <input
                type="password"
                value={form.password_current}
                onChange={(e) => setForm({ ...form, password_current: e.target.value })}
                placeholder="Pro změnu hesla vyplňte"
                className="w-full rounded-lg border border-gray-300 px-3 py-2"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Nové heslo</label>
              <input
                type="password"
                value={form.password_new}
                onChange={(e) => setForm({ ...form, password_new: e.target.value })}
                placeholder="Min. 6 znaků"
                className="w-full rounded-lg border border-gray-300 px-3 py-2"
              />
            </div>
          </div>
          <p className="mt-2 text-sm text-gray-500">
            Heslo změňte pouze v případě, že chcete nastavit nové. Jinak pole nechte prázdná.
          </p>
        </div>

        <div className="mt-6">
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-red-600 px-6 py-2 font-medium text-white hover:bg-red-700 disabled:opacity-50"
          >
            {saving ? "Ukládám…" : "Uložit změny"}
          </button>
        </div>
      </form>
    </>
  );
}
