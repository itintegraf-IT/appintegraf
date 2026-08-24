"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  EQUIPMENT_MANUAL_CODE_HINT,
  EQUIPMENT_MANUAL_CODE_PLACEHOLDER,
} from "../_components/EquipmentCodeBadge";

type RoomInfo = { id: number; name: string; code: string };
type LookupResult = {
  type: string;
  id: number;
  name?: string;
  code?: string;
  status?: string;
  asset_tag?: string;
};

export default function EquipmentScanClient() {
  const [mode, setMode] = useState<"place" | "assign">("place");
  const [room, setRoom] = useState<RoomInfo | null>(null);
  const [manual, setManual] = useState("");
  const [log, setLog] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [protocolUrl, setProtocolUrl] = useState("");
  const scannerRef = useRef<HTMLDivElement>(null);
  const html5Ref = useRef<{ stop: () => Promise<void> } | null>(null);

  const push = (msg: string) => setLog((l) => [msg, ...l].slice(0, 30));

  const handleCode = async (raw: string) => {
    setError("");
    const code = raw.trim();
    if (!code) return;

    const res = await fetch(`/api/equipment/lookup?code=${encodeURIComponent(code)}`);
    const data: LookupResult & { error?: string } = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error ?? "Kód nenalezen");
      return;
    }

    if (mode === "place") {
      if (data.type === "room") {
        setRoom({ id: data.id, name: data.name ?? "", code: data.code ?? "" });
        push(`Místnost: ${data.code} – ${data.name}`);
        try {
          navigator.vibrate?.(50);
        } catch {
          /* ignore */
        }
        return;
      }
      if (data.type === "item") {
        if (!room) {
          setError("Nejdřív naskenujte QR místnosti");
          return;
        }
        const placeRes = await fetch("/api/equipment/placement", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            equipment_id: data.id,
            to_room_id: room.id,
            source: "scan",
          }),
        });
        const placeData = await placeRes.json().catch(() => ({}));
        if (!placeRes.ok) {
          setError(placeData.error ?? "Chyba umístění");
          return;
        }
        push(`Umístěno: ${data.name} → ${room.code}`);
        setProtocolUrl(placeData.protocolUrl ?? "");
        try {
          navigator.vibrate?.([40, 40, 40]);
        } catch {
          /* ignore */
        }
        return;
      }
      if (data.type === "qr_pool" && data.status === "available") {
        setError("Volný QR z fondu – přepněte do režimu Přiřadit QR");
        return;
      }
    }

    if (mode === "assign") {
      if (data.type === "qr_pool" && data.status === "available") {
        const name = window.prompt("Název nové položky majetku:");
        if (!name) return;
        const catRes = await fetch("/api/equipment/categories");
        const cats = await catRes.json();
        const catId = Array.isArray(cats) && cats[0] ? cats[0].id : null;
        if (!catId) {
          setError("Nejdřív vytvořte skupinu majetku");
          return;
        }
        const createRes = await fetch("/api/equipment", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name,
            category_id: catId,
            pool_qr_code: data.asset_tag ?? code,
          }),
        });
        const created = await createRes.json().catch(() => ({}));
        if (!createRes.ok) {
          setError(created.error ?? "Chyba vytvoření");
          return;
        }
        push(`Vytvořeno #${created.id} s QR ${data.asset_tag}`);
        return;
      }
      setError("Naskenujte volný QR z fondu");
    }
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!scannerRef.current) return;
      try {
        const { Html5Qrcode } = await import("html5-qrcode");
        const scanner = new Html5Qrcode("equipment-qr-reader");
        html5Ref.current = scanner;
        await scanner.start(
          { facingMode: "environment" },
          { fps: 8, qrbox: { width: 240, height: 240 } },
          (decoded) => {
            if (!cancelled) void handleCode(decoded);
          },
          () => undefined
        );
      } catch {
        setError("Kameru nelze spustit – použijte ruční zadání (HTTPS / oprávnění).");
      }
    })();
    return () => {
      cancelled = true;
      void html5Ref.current?.stop().catch(() => undefined);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, room?.id]);

  return (
    <div className="mx-auto max-w-lg space-y-4 p-2">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Skenovat a spárovat</h1>
        <div className="flex gap-3 text-sm">
          <Link href="/equipment?scope=all&unassigned=1" className="text-red-700">
            Nezařazené
          </Link>
          <Link href="/equipment" className="text-red-700">
            Zpět
          </Link>
        </div>
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          className={`flex-1 rounded-lg py-2 text-sm ${mode === "place" ? "bg-red-600 text-white" : "border"}`}
          onClick={() => setMode("place")}
        >
          Spárovat s místností
        </button>
        <button
          type="button"
          className={`flex-1 rounded-lg py-2 text-sm ${mode === "assign" ? "bg-red-600 text-white" : "border"}`}
          onClick={() => setMode("assign")}
        >
          Přiřadit QR
        </button>
      </div>

      {mode === "place" && room ? (
        <div className="rounded-lg bg-green-50 p-3 text-sm">
          Cílová místnost: <strong>{room.code} – {room.name}</strong>
          <button
            type="button"
            className="ml-2 text-red-700 underline"
            onClick={() => setRoom(null)}
          >
            Změnit
          </button>
        </div>
      ) : mode === "place" ? (
        <p className="text-sm text-gray-600">
          Nejdřív naskenujte QR místnosti, potom QR majetku. Místnost zůstane nastavená,
          další kusy jdou za sebou.
        </p>
      ) : (
        <p className="text-sm text-gray-600">Naskenujte volný QR ze štítku fondu</p>
      )}

      <div
        id="equipment-qr-reader"
        ref={scannerRef}
        className="overflow-hidden rounded-xl border bg-black"
      />

      <form
        className="space-y-1"
        onSubmit={(e) => {
          e.preventDefault();
          void handleCode(manual);
          setManual("");
        }}
      >
        <label className="block text-sm font-medium text-gray-700">
          Ruční zadání kódu
        </label>
        <div className="flex gap-2">
          <input
            className="flex-1 rounded-lg border px-3 py-2 font-mono"
            placeholder={EQUIPMENT_MANUAL_CODE_PLACEHOLDER}
            value={manual}
            onChange={(e) => setManual(e.target.value)}
            autoComplete="off"
          />
          <button type="submit" className="rounded-lg bg-gray-800 px-3 py-2 text-white">
            OK
          </button>
        </div>
        <p className="text-xs text-gray-500">{EQUIPMENT_MANUAL_CODE_HINT}</p>
      </form>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {protocolUrl ? (
        <a href={protocolUrl} className="block text-sm text-red-700 underline">
          Tisk protokolu přesunu
        </a>
      ) : null}

      <ul className="space-y-1 text-sm text-gray-700">
        {log.map((l, i) => (
          <li key={`${i}-${l}`}>{l}</li>
        ))}
      </ul>
    </div>
  );
}
