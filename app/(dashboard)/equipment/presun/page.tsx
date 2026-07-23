"use client";

import { useState } from "react";
import Link from "next/link";
import {
  EQUIPMENT_MANUAL_CODE_HINT,
  EQUIPMENT_MANUAL_CODE_PLACEHOLDER,
} from "../_components/EquipmentCodeBadge";

export default function PresunPage() {
  const [code, setCode] = useState("");
  const [item, setItem] = useState<{ id: number; name: string; room?: { id: number } | null } | null>(
    null
  );
  const [rooms, setRooms] = useState<{ id: number; name: string; code: string }[]>([]);
  const [toRoom, setToRoom] = useState("");
  const [notes, setNotes] = useState("");
  const [msg, setMsg] = useState("");
  const [protocolUrl, setProtocolUrl] = useState("");

  const lookup = async () => {
    setMsg("");
    const res = await fetch(`/api/equipment/lookup?code=${encodeURIComponent(code)}`);
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.type !== "item") {
      setMsg(data.error ?? "Položka nenalezena");
      setItem(null);
      return;
    }
    setItem(data);
    const r = await fetch("/api/equipment/rooms");
    setRooms(await r.json());
  };

  const transfer = async () => {
    if (!item) return;
    const res = await fetch("/api/equipment/transfers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        equipment_id: item.id,
        to_room_id: parseInt(toRoom, 10),
        notes,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setMsg(data.error ?? "Chyba");
      return;
    }
    setMsg("Přesun dokončen.");
    setProtocolUrl(data.protocolUrl ?? "");
  };

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <div className="flex justify-between">
        <h1 className="text-2xl font-bold">Přesun majetku</h1>
        <Link href="/equipment" className="text-sm text-red-700">
          Zpět
        </Link>
      </div>
      <form
        className="space-y-1"
        onSubmit={(e) => {
          e.preventDefault();
          void lookup();
        }}
      >
        <label className="block text-sm font-medium text-gray-700">
          Inventární č. / kód
        </label>
        <div className="flex gap-2">
          <input
            className="flex-1 rounded border px-3 py-2 font-mono"
            placeholder={EQUIPMENT_MANUAL_CODE_PLACEHOLDER}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            autoComplete="off"
          />
          <button type="submit" className="rounded bg-gray-800 px-3 text-white">
            Najít
          </button>
        </div>
        <p className="text-xs text-gray-500">{EQUIPMENT_MANUAL_CODE_HINT}</p>
      </form>
      {item ? (
        <div className="space-y-3 rounded-xl border bg-white p-4">
          <p className="font-medium">{item.name}</p>
          <select
            className="w-full rounded border px-3 py-2"
            value={toRoom}
            onChange={(e) => setToRoom(e.target.value)}
          >
            <option value="">Cílová místnost</option>
            {rooms.map((r) => (
              <option key={r.id} value={r.id}>
                {r.code} – {r.name}
              </option>
            ))}
          </select>
          <textarea
            className="w-full rounded border px-3 py-2"
            rows={2}
            placeholder="Poznámka"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
          <button
            type="button"
            disabled={!toRoom}
            onClick={() => void transfer()}
            className="rounded-lg bg-red-600 px-4 py-2 text-white disabled:opacity-50"
          >
            Přesunout
          </button>
        </div>
      ) : null}
      {msg ? <p className="text-sm">{msg}</p> : null}
      {protocolUrl ? (
        <a href={protocolUrl} className="text-sm text-red-700 underline">
          Tisk protokolu
        </a>
      ) : null}
    </div>
  );
}
