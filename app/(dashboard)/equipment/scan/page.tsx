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
type PendingItem = { id: number; name: string; assetTag: string | null };

export default function EquipmentScanClient() {
  const [mode, setMode] = useState<"place" | "assign">("place");
  const [room, setRoom] = useState<RoomInfo | null>(null);
  const [manual, setManual] = useState("");
  const [log, setLog] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [protocolUrl, setProtocolUrl] = useState("");
  const [pendingItem, setPendingItem] = useState<PendingItem | null>(null);
  const [placing, setPlacing] = useState(false);
  const scannerRef = useRef<HTMLDivElement>(null);
  const html5Ref = useRef<{ stop: () => Promise<void> } | null>(null);
  const roomRef = useRef<RoomInfo | null>(null);
  const modeRef = useRef(mode);
  const busyRef = useRef(false);
  const skipItemIdRef = useRef<number | null>(null);
  const skipUntilRef = useRef(0);

  roomRef.current = room;
  modeRef.current = mode;

  const push = (msg: string) => setLog((l) => [msg, ...l].slice(0, 30));

  const placeItem = async (item: PendingItem, target: RoomInfo) => {
    const placeRes = await fetch("/api/equipment/placement", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        equipment_id: item.id,
        to_room_id: target.id,
        source: "scan",
      }),
    });
    const placeData = await placeRes.json().catch(() => ({}));
    if (!placeRes.ok) {
      setError(placeData.error ?? "Chyba umístění");
      return;
    }
    push(`Umístěno: ${item.name} → ${target.code}`);
    setProtocolUrl(placeData.protocolUrl ?? "");
    try {
      navigator.vibrate?.([40, 40, 40]);
    } catch {
      /* ignore */
    }
  };

  const confirmPlace = async () => {
    const item = pendingItem;
    const target = roomRef.current;
    if (!item || !target) return;
    setPlacing(true);
    busyRef.current = true;
    try {
      await placeItem(item, target);
      skipItemIdRef.current = item.id;
      skipUntilRef.current = Date.now() + 2000;
      setPendingItem(null);
    } finally {
      setPlacing(false);
      busyRef.current = false;
    }
  };

  const cancelPlace = () => {
    if (pendingItem) {
      skipItemIdRef.current = pendingItem.id;
      skipUntilRef.current = Date.now() + 2000;
    }
    setPendingItem(null);
    busyRef.current = false;
  };

  const handleCodeSafe = async (raw: string) => {
    if (busyRef.current) return;
    setError("");
    const code = raw.trim();
    if (!code) return;

    busyRef.current = true;
    let keepLock = false;
    try {
      const res = await fetch(`/api/equipment/lookup?code=${encodeURIComponent(code)}`);
      const data: LookupResult & { error?: string } = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Kód nenalezen");
        return;
      }

      const currentMode = modeRef.current;
      const currentRoom = roomRef.current;

      if (currentMode === "place") {
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
          if (!currentRoom) {
            setError("Nejdřív naskenujte QR místnosti");
            return;
          }
          if (skipItemIdRef.current === data.id && Date.now() < skipUntilRef.current) {
            return;
          }
          skipItemIdRef.current = null;
          keepLock = true;
          setPendingItem({
            id: data.id,
            name: data.name ?? `Položka #${data.id}`,
            assetTag: data.asset_tag ?? null,
          });
          try {
            navigator.vibrate?.(50);
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

      if (currentMode === "assign") {
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
    } finally {
      if (!keepLock) busyRef.current = false;
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
            if (!cancelled) void handleCodeSafe(decoded);
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
  }, [mode]);

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
          onClick={() => {
            setPendingItem(null);
            busyRef.current = false;
            setMode("place");
          }}
        >
          Spárovat s místností
        </button>
        <button
          type="button"
          className={`flex-1 rounded-lg py-2 text-sm ${mode === "assign" ? "bg-red-600 text-white" : "border"}`}
          onClick={() => {
            setPendingItem(null);
            busyRef.current = false;
            setMode("assign");
          }}
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
            onClick={() => {
              setRoom(null);
              setPendingItem(null);
              busyRef.current = false;
            }}
          >
            Změnit
          </button>
        </div>
      ) : mode === "place" ? (
        <p className="text-sm text-gray-600">
          Nejdřív naskenujte QR místnosti, potom QR majetku. Místnost zůstane nastavená,
          další kusy jdou za sebou. Před uložením se zeptáme na potvrzení.
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
          void handleCodeSafe(manual);
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

      {pendingItem && room ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="scan-confirm-title"
            className="w-full max-w-md space-y-4 rounded-xl bg-white p-5 shadow-lg"
          >
            <h3 id="scan-confirm-title" className="text-lg font-semibold text-gray-900">
              Umístit majetek do místnosti?
            </h3>
            <p className="text-sm text-gray-700">
              Opravdu umístit <strong>„{pendingItem.name}”</strong>
              {pendingItem.assetTag ? (
                <>
                  {" "}
                  (inv. <span className="font-mono">{pendingItem.assetTag}</span>)
                </>
              ) : null}{" "}
              do <strong>{room.code} – {room.name}</strong>?
            </p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                disabled={placing}
                onClick={() => void confirmPlace()}
                className="flex-1 rounded-lg bg-red-600 px-4 py-3 text-base font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                {placing ? "Umísťuji…" : "Ano, umístit"}
              </button>
              <button
                type="button"
                disabled={placing}
                onClick={cancelPlace}
                className="flex-1 rounded-lg border border-gray-300 px-4 py-3 text-base font-medium text-gray-800 hover:bg-gray-50 disabled:opacity-50"
              >
                Zrušit
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
