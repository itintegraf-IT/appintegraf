"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { EquipmentCodeBadge } from "../../_components/EquipmentCodeBadge";

type Item = {
  id: number;
  name: string;
  asset_tag: string | null;
  equipment_categories: { name: string };
};

export default function RoomDetailClient() {
  const params = useParams();
  const id = params.id as string;
  const [room, setRoom] = useState<{
    id: number;
    name: string;
    code: string;
    qr_code: string;
    building: string | null;
    floor: string | null;
    items: Item[];
  } | null>(null);
  const [selected, setSelected] = useState<number[]>([]);
  const [rooms, setRooms] = useState<{ id: number; name: string; code: string }[]>([]);
  const [toRoom, setToRoom] = useState("");
  const [msg, setMsg] = useState("");

  useEffect(() => {
    fetch(`/api/equipment/rooms/${id}`)
      .then((r) => r.json())
      .then((d) => setRoom(d));
    fetch("/api/equipment/rooms")
      .then((r) => r.json())
      .then((d) => setRooms(Array.isArray(d) ? d : []));
  }, [id]);

  const toggle = (itemId: number) => {
    setSelected((p) => (p.includes(itemId) ? p.filter((x) => x !== itemId) : [...p, itemId]));
  };

  const bulkMove = async () => {
    setMsg("");
    const res = await fetch("/api/equipment/transfers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        equipment_ids: selected,
        to_room_id: parseInt(toRoom, 10),
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setMsg(data.error ?? "Chyba");
      return;
    }
    setMsg(`Přesunuto ${data.results?.length ?? 0} položek.`);
    setSelected([]);
    const r = await fetch(`/api/equipment/rooms/${id}`);
    setRoom(await r.json());
  };

  if (!room) return <p className="p-4 text-gray-500">Načítání…</p>;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold">
            {room.code} – {room.name}
          </h1>
          <p className="text-gray-600">
            {[room.building, room.floor].filter(Boolean).join(", ") || "Místnost"}
          </p>
        </div>
        <div className="flex gap-2">
          <a
            href={`/api/equipment/rooms/${room.id}/label`}
            className="rounded-lg border px-3 py-2 text-sm"
          >
            Tisk štítku
          </a>
          <Link href="/equipment/rooms" className="rounded-lg border px-3 py-2 text-sm">
            Zpět
          </Link>
        </div>
      </div>

      <EquipmentCodeBadge
        primaryLabel="Kód místnosti"
        primaryCode={room.code}
        secondaryCode={room.qr_code !== room.code ? room.qr_code : null}
        qrSrc={`/api/equipment/qr?code=${encodeURIComponent(room.qr_code)}&type=rm`}
        hint="Tento kód zadejte ručně při skenování, pokud nelze naskenovat QR."
      />

      {selected.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-amber-50 p-3">
          <span>Vybráno: {selected.length}</span>
          <select
            className="rounded border px-2 py-1"
            value={toRoom}
            onChange={(e) => setToRoom(e.target.value)}
          >
            <option value="">Cílová místnost</option>
            {rooms
              .filter((r) => r.id !== room.id)
              .map((r) => (
                <option key={r.id} value={r.id}>
                  {r.code} – {r.name}
                </option>
              ))}
          </select>
          <button
            type="button"
            disabled={!toRoom}
            onClick={() => void bulkMove()}
            className="rounded bg-red-600 px-3 py-1 text-white disabled:opacity-50"
          >
            Přesunout vybrané
          </button>
        </div>
      ) : null}
      {msg ? <p className="text-sm text-green-700">{msg}</p> : null}

      <table className="min-w-full rounded-xl border bg-white text-sm shadow-sm">
        <thead className="bg-gray-50 text-left">
          <tr>
            <th className="px-3 py-2" />
            <th className="px-3 py-2">Název</th>
            <th className="px-3 py-2">Inv. č.</th>
            <th className="px-3 py-2">Skupina</th>
          </tr>
        </thead>
        <tbody>
          {(room.items ?? []).map((it) => (
            <tr key={it.id} className="border-t">
              <td className="px-3 py-2">
                <input
                  type="checkbox"
                  checked={selected.includes(it.id)}
                  onChange={() => toggle(it.id)}
                />
              </td>
              <td className="px-3 py-2">
                <Link href={`/equipment/${it.id}`} className="text-red-700 hover:underline">
                  {it.name}
                </Link>
              </td>
              <td className="px-3 py-2 font-mono">{it.asset_tag ?? "—"}</td>
              <td className="px-3 py-2">{it.equipment_categories?.name}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
