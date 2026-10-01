"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { Html5Qrcode } from "html5-qrcode";
import { AlertCircle, Info } from "lucide-react";
import {
  EQUIPMENT_MANUAL_CODE_HINT_WITH_ROOM,
  EQUIPMENT_MANUAL_CODE_PLACEHOLDER_WITH_ROOM,
} from "../_components/EquipmentCodeBadge";
import { EquipmentDialog } from "../_components/EquipmentDialog";
import { askSendEquipmentMovementNotify } from "@/lib/equipment/ask-send-notify";
import { createScanGate } from "@/lib/equipment/scan-gate";

type RoomInfo = { id: number; name: string; code: string };
type LookupResult = {
  type: string;
  id: number;
  name?: string;
  code?: string;
  status?: string;
  asset_tag?: string;
  qr_code?: string;
  /** U položky: místnost, ve které je evidovaná. */
  room?: { id: number; name: string; code: string } | null;
};
type PendingItem = { id: number; name: string; assetTag: string | null };
type Choice = { item: LookupResult; room: LookupResult };

const NETWORK_ERROR = "Spojení se serverem selhalo. Nic se neuložilo — zkuste to znovu.";

function vibrate(pattern: number | number[]) {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    /* ignore */
  }
}

export default function EquipmentScanClient() {
  const router = useRouter();
  const [mode, setMode] = useState<"place" | "assign">("place");
  const [room, setRoom] = useState<RoomInfo | null>(null);
  const [manual, setManual] = useState("");
  const [log, setLog] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [protocolUrl, setProtocolUrl] = useState("");
  const [pendingItem, setPendingItem] = useState<PendingItem | null>(null);
  const [choice, setChoice] = useState<Choice | null>(null);
  const [placing, setPlacing] = useState(false);
  const scannerRef = useRef<HTMLDivElement>(null);
  const roomRef = useRef<RoomInfo | null>(null);
  const modeRef = useRef(mode);
  const busyRef = useRef(false);
  /** Brána proti opakovanému zpracování kódu, který drží v záběru kamery. */
  const gateRef = useRef(createScanGate());

  roomRef.current = room;
  modeRef.current = mode;

  const push = (msg: string) => setLog((l) => [msg, ...l].slice(0, 30));

  const placeItem = async (item: PendingItem, target: RoomInfo) => {
    const notify = askSendEquipmentMovementNotify();
    let placeRes: Response;
    try {
      placeRes = await fetch("/api/equipment/placement", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ equipment_id: item.id, to_room_id: target.id, source: "scan", notify }),
      });
    } catch {
      setError(NETWORK_ERROR);
      return;
    }
    const placeData = await placeRes.json().catch(() => ({}));
    if (!placeRes.ok) {
      setError(placeData.error ?? "Umístění se nepodařilo.");
      return;
    }
    push(`Umístěno: ${item.name} → ${target.code}`);
    setProtocolUrl(placeData.protocolUrl ?? "");
    vibrate([40, 40, 40]);
  };

  const confirmPlace = async () => {
    const item = pendingItem;
    const target = roomRef.current;
    if (!item || !target) return;
    setPlacing(true);
    try {
      await placeItem(item, target);
    } finally {
      setPlacing(false);
      setPendingItem(null);
      busyRef.current = false;
    }
  };

  const cancelPlace = () => {
    setPendingItem(null);
    busyRef.current = false;
  };

  /** Zpracuje výsledek lookupu; true = otevřel se dialog a zámek zůstává. */
  const applyResult = (data: LookupResult): boolean => {
    const currentRoom = roomRef.current;

    if (modeRef.current === "assign") {
      if (data.type === "qr_pool" && data.status === "available") {
        // Zařazení s povinnými údaji nákupu (cena, datum, doklad) jen přes formulář.
        const params = new URLSearchParams({ pool: String(data.qr_code ?? "") });
        if (currentRoom) params.set("room", String(currentRoom.id));
        router.push(`/equipment/add?${params.toString()}`);
        return false;
      }
      setError("Naskenujte volný QR z fondu.");
      return false;
    }

    if (data.type === "room") {
      if (currentRoom?.id === data.id) {
        setInfo(`Místnost ${data.code} – ${data.name} už je vybraná.`);
        return false;
      }
      setRoom({ id: data.id, name: data.name ?? "", code: data.code ?? "" });
      push(`Místnost: ${data.code} – ${data.name}`);
      vibrate(50);
      return false;
    }
    if (data.type === "item") {
      if (!currentRoom) {
        setError("Nejdřív naskenujte QR místnosti.");
        return false;
      }
      const name = data.name ?? `Položka #${data.id}`;
      if (data.room?.id === currentRoom.id) {
        setInfo(`„${name}“ už je v místnosti ${currentRoom.code}.`);
        return false;
      }
      setPendingItem({ id: data.id, name, assetTag: data.asset_tag ?? null });
      vibrate(50);
      return true;
    }
    if (data.type === "qr_pool" && data.status === "available") {
      setError("Volný QR z fondu – přepněte do režimu Přiřadit QR.");
      return false;
    }
    setError("Tento kód tu nejde použít.");
    return false;
  };

  const handleCode = async (raw: string, source: "camera" | "manual") => {
    const code = raw.trim();
    if (!code) return;
    const now = Date.now();
    if (source === "camera" && !gateRef.current.shouldHandle(code, now)) return;
    if (busyRef.current) return;
    busyRef.current = true;
    if (source === "camera") gateRef.current.markHandled(code, now);
    setError("");
    setInfo("");

    let keepLock = false;
    try {
      let res: Response;
      try {
        res = await fetch(`/api/equipment/lookup?code=${encodeURIComponent(code)}`);
      } catch {
        setError(NETWORK_ERROR);
        return;
      }
      const data: LookupResult & { error?: string; item?: LookupResult; room?: LookupResult } = await res
        .json()
        .catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Kód nenalezen.");
        return;
      }
      if (data.type === "ambiguous" && data.item && data.room) {
        keepLock = true;
        setChoice({ item: data.item, room: data.room as LookupResult });
        return;
      }
      keepLock = applyResult(data);
    } finally {
      if (!keepLock) busyRef.current = false;
    }
  };

  // Kamera volá vždy nejnovější handleCode (efekt kamery běží jen jednou).
  const handleCodeRef = useRef(handleCode);
  handleCodeRef.current = handleCode;

  useEffect(() => {
    let cancelled = false;
    let scanner: Html5Qrcode | null = null;
    let started: Promise<unknown> | null = null;
    (async () => {
      if (!scannerRef.current) return;
      try {
        const { Html5Qrcode } = await import("html5-qrcode");
        if (cancelled) return;
        scanner = new Html5Qrcode("equipment-qr-reader");
        started = scanner.start(
          { facingMode: "environment" },
          { fps: 8, qrbox: { width: 240, height: 240 } },
          (decoded) => {
            if (!cancelled) void handleCodeRef.current(decoded, "camera");
          },
          () => undefined
        );
        await started;
      } catch {
        if (!cancelled) setError("Kameru nelze spustit – použijte ruční zadání (HTTPS / oprávnění).");
      }
    })();
    return () => {
      cancelled = true;
      const s = scanner;
      // Kamera se vypne, i když odchod přišel během dotazu na povolení (start ještě běží).
      if (s && started) {
        void started.then(() => s.stop()).then(() => s.clear()).catch(() => undefined);
      }
    };
  }, []);

  const switchMode = (next: "place" | "assign") => {
    setPendingItem(null);
    setChoice(null);
    busyRef.current = false;
    gateRef.current.reset();
    setMode(next);
  };

  const pick = (result: LookupResult) => {
    setChoice(null);
    const keepLock = applyResult(result);
    if (!keepLock) busyRef.current = false;
  };

  const modeButton = (value: "place" | "assign", label: string) => (
    <button
      type="button"
      aria-pressed={mode === value}
      className={`min-h-11 flex-1 rounded-lg px-2 text-sm font-medium ${
        mode === value ? "bg-primary text-primary-foreground" : "border border-border hover:bg-muted"
      }`}
      onClick={() => switchMode(value)}
    >
      {label}
    </button>
  );

  return (
    <div className="mx-auto max-w-lg space-y-4 p-2">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Skenovat a spárovat</h1>
        <div className="flex gap-3 text-sm">
          <Link href="/equipment?scope=all&unassigned=1" className="text-primary">
            Nezařazené
          </Link>
          <Link href="/equipment" className="text-primary">
            Zpět
          </Link>
        </div>
      </div>

      <div className="flex gap-2">
        {modeButton("place", "Spárovat s místností")}
        {modeButton("assign", "Přiřadit QR")}
      </div>

      {mode === "place" && room ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-card p-3 text-sm">
          <span>
            Cílová místnost: <strong>{room.code} – {room.name}</strong>
          </span>
          <button
            type="button"
            className="min-h-11 rounded-lg border border-border px-3 hover:bg-muted"
            onClick={() => {
              setRoom(null);
              setPendingItem(null);
              busyRef.current = false;
              gateRef.current.reset();
            }}
          >
            Změnit
          </button>
        </div>
      ) : mode === "place" ? (
        <p className="text-sm text-muted-foreground">
          Nejdřív naskenujte QR místnosti, potom QR majetku. Místnost zůstane nastavená, další kusy jdou
          za sebou. Před uložením se zeptáme na potvrzení.
        </p>
      ) : (
        <p className="text-sm text-muted-foreground">Naskenujte volný QR ze štítku fondu.</p>
      )}

      <div id="equipment-qr-reader" ref={scannerRef} className="overflow-hidden rounded-xl border bg-black" />

      <form
        className="space-y-1"
        onSubmit={(e) => {
          e.preventDefault();
          void handleCode(manual, "manual");
          setManual("");
        }}
      >
        <label htmlFor="scan-manual" className="block text-sm font-medium">
          Ruční zadání kódu
        </label>
        <div className="flex gap-2">
          <input
            id="scan-manual"
            className="min-h-11 flex-1 rounded-lg border border-border bg-background px-3 font-mono"
            placeholder={EQUIPMENT_MANUAL_CODE_PLACEHOLDER_WITH_ROOM}
            value={manual}
            onChange={(e) => setManual(e.target.value)}
            autoComplete="off"
          />
          <button type="submit" className="min-h-11 rounded-lg bg-primary px-4 font-medium text-primary-foreground">
            OK
          </button>
        </div>
        <p className="text-xs text-muted-foreground">{EQUIPMENT_MANUAL_CODE_HINT_WITH_ROOM}</p>
      </form>

      {error ? (
        <p role="alert" className="flex items-start gap-2 rounded-lg border border-primary/40 p-3 text-sm font-medium text-primary dark:text-destructive">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          {error}
        </p>
      ) : null}
      {info ? (
        <p role="status" className="flex items-start gap-2 rounded-lg border border-border p-3 text-sm">
          <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          {info}
        </p>
      ) : null}
      {protocolUrl ? (
        <a href={protocolUrl} className="block text-sm text-primary underline">
          Tisk protokolu přesunu
        </a>
      ) : null}

      <ul className="space-y-1 text-sm text-muted-foreground">
        {log.map((l, i) => (
          <li key={`${i}-${l}`}>{l}</li>
        ))}
      </ul>

      <EquipmentDialog
        open={!!pendingItem && !!room}
        title="Umístit majetek do místnosti?"
        confirmLabel="Ano, umístit"
        busy={placing}
        onConfirm={() => void confirmPlace()}
        onCancel={cancelPlace}
      >
        {pendingItem && room ? (
          <p>
            Umístit <strong>„{pendingItem.name}“</strong>
            {pendingItem.assetTag ? (
              <>
                {" "}
                (inv. <span className="font-mono">{pendingItem.assetTag}</span>)
              </>
            ) : null}{" "}
            do <strong>{room.code} – {room.name}</strong>?
          </p>
        ) : null}
      </EquipmentDialog>

      <EquipmentDialog
        open={!!choice}
        title="Kód odpovídá místnosti i položce"
        onCancel={() => {
          setChoice(null);
          busyRef.current = false;
        }}
      >
        {choice ? (
          <div className="space-y-2">
            <p>Vyberte, co jste zadali:</p>
            <button
              type="button"
              onClick={() => pick(choice.room)}
              className="min-h-11 w-full rounded-lg border border-border px-3 py-2 text-left text-foreground hover:bg-muted"
            >
              Místnost <strong>{choice.room.code}</strong> – {choice.room.name}
            </button>
            <button
              type="button"
              onClick={() => pick(choice.item)}
              className="min-h-11 w-full rounded-lg border border-border px-3 py-2 text-left text-foreground hover:bg-muted"
            >
              Položka <strong className="font-mono">{choice.item.asset_tag}</strong> – {choice.item.name}
            </button>
          </div>
        ) : null}
      </EquipmentDialog>
    </div>
  );
}
