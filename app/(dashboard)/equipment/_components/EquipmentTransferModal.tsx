"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Room = { id: number; name: string; code: string };

export function EquipmentTransferModal({
  equipmentId,
  rooms,
  currentRoomId,
}: {
  equipmentId: number;
  rooms: Room[];
  currentRoomId: number | null;
}) {
  const [open, setOpen] = useState(false);
  const [toRoom, setToRoom] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [protocolUrl, setProtocolUrl] = useState("");
  const router = useRouter();

  const submit = async () => {
    setError("");
    const res = await fetch("/api/equipment/transfers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        equipment_id: equipmentId,
        to_room_id: parseInt(toRoom, 10),
        notes,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error ?? "Chyba");
      return;
    }
    setProtocolUrl(data.protocolUrl ?? "");
    router.refresh();
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-lg border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50"
      >
        Přesunout
      </button>
      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-4 shadow-lg space-y-3">
            <h3 className="font-semibold">Přesun do místnosti</h3>
            <select
              className="w-full rounded border px-3 py-2"
              value={toRoom}
              onChange={(e) => setToRoom(e.target.value)}
            >
              <option value="">— Cílová místnost —</option>
              {rooms
                .filter((r) => r.id !== currentRoomId)
                .map((r) => (
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
            {error ? <p className="text-sm text-red-600">{error}</p> : null}
            {protocolUrl ? (
              <a href={protocolUrl} className="block text-sm text-red-700 underline">
                Tisk protokolu
              </a>
            ) : null}
            <div className="flex gap-2">
              <button
                type="button"
                disabled={!toRoom}
                onClick={() => void submit()}
                className="rounded-lg bg-red-600 px-4 py-2 text-white disabled:opacity-50"
              >
                Potvrdit
              </button>
              <button type="button" onClick={() => setOpen(false)} className="rounded-lg border px-4 py-2">
                Zavřít
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
