"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  EQUIPMENT_MANUAL_CODE_HINT,
  EQUIPMENT_MANUAL_CODE_PLACEHOLDER,
} from "../_components/EquipmentCodeBadge";

type Inv = {
  id: number;
  name: string;
  status: string;
  scope_type: string;
  _count: { lines: number };
};

export default function InventuraClient() {
  const [list, setList] = useState<Inv[]>([]);
  const [name, setName] = useState("");
  const [scope, setScope] = useState("all");
  const [cats, setCats] = useState<{ id: number; name: string }[]>([]);
  const [rooms, setRooms] = useState<{ id: number; name: string; code: string }[]>([]);
  const [scopeId, setScopeId] = useState("");
  const [activeId, setActiveId] = useState<number | null>(null);
  const [detail, setDetail] = useState<{
    lines: {
      line_status: string;
      equipment_items: { name: string; asset_tag: string | null };
    }[];
  } | null>(null);
  const [scanCode, setScanCode] = useState("");
  const [msg, setMsg] = useState("");

  const load = () => {
    fetch("/api/equipment/inventories")
      .then((r) => r.json())
      .then((d) => setList(Array.isArray(d) ? d : []));
  };

  useEffect(() => {
    load();
    fetch("/api/equipment/categories")
      .then((r) => r.json())
      .then((d) => setCats(Array.isArray(d) ? d : []));
    fetch("/api/equipment/rooms")
      .then((r) => r.json())
      .then((d) => setRooms(Array.isArray(d) ? d : []));
  }, []);

  const create = async () => {
    const res = await fetch("/api/equipment/inventories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: name || undefined,
        scope_type: scope,
        scope_id: scopeId || null,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setMsg(data.error ?? "Chyba");
      return;
    }
    setActiveId(data.id);
    load();
    openDetail(data.id);
  };

  const openDetail = async (id: number) => {
    setActiveId(id);
    const res = await fetch(`/api/equipment/inventories/${id}`);
    setDetail(await res.json());
  };

  const scan = async () => {
    if (!activeId || !scanCode.trim()) return;
    const res = await fetch(`/api/equipment/inventories/${activeId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "scan", code: scanCode.trim() }),
    });
    const data = await res.json().catch(() => ({}));
    setMsg(res.ok ? `${data.name}: ${data.lineStatus}` : data.error ?? "Chyba");
    setScanCode("");
    openDetail(activeId);
  };

  const complete = async () => {
    if (!activeId) return;
    await fetch(`/api/equipment/inventories/${activeId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "complete" }),
    });
    load();
    openDetail(activeId);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between">
        <div>
          <h1 className="text-2xl font-bold">Inventura</h1>
          <p className="text-gray-600">Rozsah: kompletní / skupina / místnost</p>
        </div>
        <Link href="/equipment" className="rounded-lg border px-3 py-2 text-sm">
          Zpět
        </Link>
      </div>

      <div className="rounded-xl border bg-white p-4 space-y-2">
        <input
          className="w-full rounded border px-3 py-2"
          placeholder="Název inventury"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <select
          className="w-full rounded border px-3 py-2"
          value={scope}
          onChange={(e) => {
            setScope(e.target.value);
            setScopeId("");
          }}
        >
          <option value="all">Kompletní</option>
          <option value="category">Skupina</option>
          <option value="room">Místnost</option>
        </select>
        {scope === "category" ? (
          <select
            className="w-full rounded border px-3 py-2"
            value={scopeId}
            onChange={(e) => setScopeId(e.target.value)}
          >
            <option value="">— Skupina —</option>
            {cats.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        ) : null}
        {scope === "room" ? (
          <select
            className="w-full rounded border px-3 py-2"
            value={scopeId}
            onChange={(e) => setScopeId(e.target.value)}
          >
            <option value="">— Místnost —</option>
            {rooms.map((r) => (
              <option key={r.id} value={r.id}>
                {r.code} – {r.name}
              </option>
            ))}
          </select>
        ) : null}
        <button
          type="button"
          onClick={() => void create()}
          className="rounded-lg bg-red-600 px-4 py-2 text-white"
        >
          Spustit inventuru
        </button>
      </div>

      <ul className="space-y-1 text-sm">
        {list.map((inv) => (
          <li key={inv.id}>
            <button
              type="button"
              className="text-red-700 hover:underline"
              onClick={() => void openDetail(inv.id)}
            >
              #{inv.id} {inv.name} ({inv.status}, {inv._count.lines} řádků, {inv.scope_type})
            </button>
          </li>
        ))}
      </ul>

      {activeId && detail ? (
        <div className="rounded-xl border bg-white p-4 space-y-3">
          <h2 className="font-semibold">Inventura #{activeId}</h2>
          <form
            className="space-y-1"
            onSubmit={(e) => {
              e.preventDefault();
              void scan();
            }}
          >
            <label className="block text-sm font-medium text-gray-700">
              Sken / ruční kód
            </label>
            <div className="flex gap-2">
              <input
                className="flex-1 rounded border px-3 py-2 font-mono"
                placeholder={EQUIPMENT_MANUAL_CODE_PLACEHOLDER}
                value={scanCode}
                onChange={(e) => setScanCode(e.target.value)}
                autoComplete="off"
              />
              <button type="submit" className="rounded bg-gray-800 px-3 text-white">
                Sken
              </button>
              <button type="button" onClick={() => void complete()} className="rounded border px-3">
                Uzavřít
              </button>
            </div>
            <p className="text-xs text-gray-500">
              {EQUIPMENT_MANUAL_CODE_HINT} Potvrďte Enterem.
            </p>
          </form>
          {msg ? <p className="text-sm">{msg}</p> : null}
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left">
                <th className="py-1">Položka</th>
                <th>Stav</th>
              </tr>
            </thead>
            <tbody>
              {detail.lines?.map((l, i) => (
                <tr key={i} className="border-t">
                  <td className="py-1">
                    {l.equipment_items.name}{" "}
                    <span className="font-mono text-xs">{l.equipment_items.asset_tag}</span>
                  </td>
                  <td>{l.line_status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
