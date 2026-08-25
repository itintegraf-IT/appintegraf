"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { normalizeEquipmentSearch } from "../_components/EquipmentFilterCombobox";

type Room = {
  id: number;
  name: string;
  code: string;
  building: string | null;
  floor: string | null;
  qr_code: string;
  is_active: boolean;
  _count?: { equipment_items: number };
};

const emptyForm = { name: "", code: "", building: "", floor: "" };

export default function RoomsClient() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [editing, setEditing] = useState<Room | null>(null);
  const [error, setError] = useState("");
  const [okMsg, setOkMsg] = useState("");
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const formRef = useRef<HTMLDivElement>(null);

  const load = async () => {
    try {
      const r = await fetch("/api/equipment/rooms?all=1");
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        setError(typeof d.error === "string" ? d.error : "Chyba načítání místností");
        setRooms([]);
        return;
      }
      setRooms(Array.isArray(d) ? d : []);
    } catch {
      setError("Chyba načítání místností");
      setRooms([]);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const resetForm = () => {
    setEditing(null);
    setForm(emptyForm);
  };

  const startEdit = (r: Room) => {
    setError("");
    setOkMsg("");
    setEditing(r);
    setForm({
      name: r.name,
      code: r.code,
      building: r.building ?? "",
      floor: r.floor ?? "",
    });
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const save = async () => {
    setError("");
    setOkMsg("");
    const name = form.name.trim();
    const code = form.code.trim().toUpperCase();
    if (!name || !code) {
      setError("Název a kód jsou povinné.");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(
        editing ? `/api/equipment/rooms/${editing.id}` : "/api/equipment/rooms",
        {
          method: editing ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name,
            code,
            building: form.building.trim() || null,
            floor: form.floor.trim() || null,
          }),
        }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? `Chyba (${res.status})`);
        return;
      }
      setOkMsg(editing ? "Místnost upravena." : "Místnost vytvořena.");
      resetForm();
      await load();
    } catch {
      setError(editing ? "Chyba při ukládání" : "Síťová chyba při vytváření místnosti");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (r: Room) => {
    const itemCount = r._count?.equipment_items ?? 0;
    if (itemCount > 0) {
      if (
        !window.confirm(
          `Místnost „${r.name}“ obsahuje ${itemCount} položek a nelze ji smazat. Chcete ji deaktivovat?`
        )
      ) {
        return;
      }
      setError("");
      setOkMsg("");
      const res = await fetch(`/api/equipment/rooms/${r.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: false }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Chyba deaktivace");
        return;
      }
      setOkMsg("Místnost deaktivována.");
      if (editing?.id === r.id) resetForm();
      await load();
      return;
    }

    if (!window.confirm(`Opravdu smazat místnost „${r.name}“ (${r.code})?`)) return;

    setError("");
    setOkMsg("");
    const res = await fetch(`/api/equipment/rooms/${r.id}`, { method: "DELETE" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error ?? "Chyba mazání");
      return;
    }
    setOkMsg(data.deactivated ? "Místnost deaktivována (historie přesunů)." : "Místnost smazána.");
    if (editing?.id === r.id) resetForm();
    await load();
  };

  const reactivate = async (r: Room) => {
    setError("");
    setOkMsg("");
    const res = await fetch(`/api/equipment/rooms/${r.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_active: true }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error ?? "Chyba obnovení");
      return;
    }
    setOkMsg("Místnost obnovena.");
    await load();
  };

  const filteredRooms = useMemo(() => {
    const q = normalizeEquipmentSearch(search);
    if (!q) return rooms;
    return rooms.filter((r) => {
      const hay = [r.code, r.name, r.building, r.floor]
        .filter(Boolean)
        .map((s) => normalizeEquipmentSearch(String(s)))
        .join(" ");
      return hay.includes(q);
    });
  }, [rooms, search]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold">Místnosti</h1>
          <p className="text-gray-600">Evidence místností a QR štítky</p>
        </div>
        <Link href="/equipment/plan" className="rounded-lg border px-3 py-2 text-sm">
          Půdorys
        </Link>
        <Link href="/equipment" className="rounded-lg border px-3 py-2 text-sm">
          Zpět
        </Link>
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {okMsg ? <p className="text-sm text-green-700">{okMsg}</p> : null}

      <div ref={formRef} className="rounded-xl border bg-white p-4 shadow-sm">
        <h2 className="mb-2 font-semibold">{editing ? "Upravit místnost" : "Nová místnost"}</h2>
        <div className="grid gap-2 sm:grid-cols-2">
          <input
            className="rounded-lg border px-3 py-2"
            placeholder="Název"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
          <input
            className="rounded-lg border px-3 py-2 font-mono uppercase"
            placeholder="Kód (např. A-205)"
            value={form.code}
            onChange={(e) => setForm({ ...form, code: e.target.value })}
          />
          <input
            className="rounded-lg border px-3 py-2"
            placeholder="Budova"
            value={form.building}
            onChange={(e) => setForm({ ...form, building: e.target.value })}
          />
          <input
            className="rounded-lg border px-3 py-2"
            placeholder="Patro"
            value={form.floor}
            onChange={(e) => setForm({ ...form, floor: e.target.value })}
          />
        </div>
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            disabled={saving}
            onClick={() => void save()}
            className="rounded-lg bg-red-600 px-4 py-2 text-white disabled:opacity-50"
          >
            {saving ? "Ukládám…" : editing ? "Uložit změny" : "Vytvořit + QR"}
          </button>
          {editing ? (
            <button type="button" onClick={resetForm} className="rounded-lg border px-4 py-2">
              Zrušit
            </button>
          ) : null}
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-gray-50 px-3 py-2">
          <p className="text-sm text-gray-600">
            Místností: <strong>{rooms.length}</strong>
            {search.trim() ? (
              <>
                {" "}
                · zobrazeno <strong>{filteredRooms.length}</strong>
              </>
            ) : null}
          </p>
          <label className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="kód, název…"
              className="w-56 rounded-lg border border-gray-300 bg-white py-1.5 pl-8 pr-2.5 text-sm"
            />
          </label>
        </div>
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-left">
            <tr>
              <th className="px-3 py-2">Kód</th>
              <th className="px-3 py-2">Název</th>
              <th className="px-3 py-2">Budova</th>
              <th className="px-3 py-2">Položek</th>
              <th className="px-3 py-2">Akce</th>
            </tr>
          </thead>
          <tbody>
            {rooms.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-gray-500">
                  Zatím žádné místnosti.
                </td>
              </tr>
            ) : filteredRooms.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-gray-500">
                  Žádná místnost neodpovídá hledání.
                </td>
              </tr>
            ) : (
              filteredRooms.map((r) => {
                const active = r.is_active !== false;
                return (
                  <tr
                    key={r.id}
                    className={`border-t ${active ? "" : "bg-gray-50 text-gray-500"}`}
                  >
                    <td className="px-3 py-2 font-mono">{r.code}</td>
                    <td className="px-3 py-2">
                      <Link href={`/equipment/rooms/${r.id}`} className="text-red-700 hover:underline">
                        {r.name}
                      </Link>
                      {!active ? (
                        <span className="ml-2 text-xs text-gray-400">(neaktivní)</span>
                      ) : null}
                    </td>
                    <td className="px-3 py-2">{r.building ?? "—"}</td>
                    <td className="px-3 py-2">{r._count?.equipment_items ?? 0}</td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-3">
                        <a
                          href={`/api/equipment/rooms/${r.id}/label`}
                          className="text-red-700 hover:underline"
                        >
                          Tisk štítku
                        </a>
                        <button
                          type="button"
                          className="text-red-700 hover:underline"
                          onClick={() => startEdit(r)}
                        >
                          Upravit
                        </button>
                        {active ? (
                          <button
                            type="button"
                            className="text-gray-700 hover:underline"
                            onClick={() => void remove(r)}
                          >
                            {(r._count?.equipment_items ?? 0) > 0 ? "Deaktivovat" : "Smazat"}
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="text-green-700 hover:underline"
                            onClick={() => void reactivate(r)}
                          >
                            Obnovit
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
