"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { Html5Qrcode } from "html5-qrcode";
import { AlertCircle, CheckCircle2, Info } from "lucide-react";
import {
  EQUIPMENT_MANUAL_CODE_HINT_WITH_ROOM,
  EQUIPMENT_MANUAL_CODE_PLACEHOLDER_WITH_ROOM,
} from "../_components/EquipmentCodeBadge";
import { EquipmentDialog } from "../_components/EquipmentDialog";
import { MovementNotifyCheckbox, useMovementNotifyPreference } from "../_components/MovementNotifyCheckbox";
import { FieldFetchTimeoutError, fieldFetch, fieldFetchErrorMessage } from "@/lib/equipment/field-fetch";
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
/** Jediné stavové místo nad kamerou — se zapnutou kamerou je vše pod ní mimo obrazovku telefonu. */
type Status = { tone: "error" | "info" | "success"; text: string; protocolUrl?: string } | null;

function vibrate(pattern: number | number[]) {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    /* ignore */
  }
}

export default function EquipmentScanClient() {
  const [room, setRoom] = useState<RoomInfo | null>(null);
  const [manual, setManual] = useState("");
  const [log, setLog] = useState<string[]>([]);
  const [status, setStatus] = useState<Status>(null);
  const [pendingItem, setPendingItem] = useState<PendingItem | null>(null);
  const [choice, setChoice] = useState<Choice | null>(null);
  const [placing, setPlacing] = useState(false);
  const [notify, setNotify] = useMovementNotifyPreference();
  const scannerRef = useRef<HTMLDivElement>(null);
  const roomRef = useRef<RoomInfo | null>(null);
  const busyRef = useRef(false);
  /** Brána proti opakovanému zpracování kódu, který drží v záběru kamery. */
  const gateRef = useRef(createScanGate());

  roomRef.current = room;

  const setError = (text: string) => setStatus({ tone: "error", text });
  const setInfo = (text: string) => setStatus({ tone: "info", text });
  const push = (msg: string) => setLog((l) => [msg, ...l].slice(0, 30));

  const placeItem = async (item: PendingItem, target: RoomInfo) => {
    let placeRes: Response;
    try {
      placeRes = await fieldFetch("/api/equipment/placement", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ equipment_id: item.id, to_room_id: target.id, source: "scan", notify }),
      });
    } catch (e) {
      setError(fieldFetchErrorMessage(e));
      return;
    }
    const placeData = await placeRes.json().catch(() => ({}));
    if (!placeRes.ok) {
      setError(placeData.error ?? "Umístění se nepodařilo.");
      return;
    }
    const text = `Umístěno: ${item.name} → ${target.code}`;
    push(text);
    setStatus({ tone: "success", text, protocolUrl: placeData.protocolUrl || undefined });
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

    if (data.type === "room") {
      if (currentRoom?.id === data.id) {
        setInfo(`Místnost ${data.code} – ${data.name} už je vybraná.`);
        return false;
      }
      setRoom({ id: data.id, name: data.name ?? "", code: data.code ?? "" });
      setStatus({ tone: "success", text: `Místnost ${data.code} – ${data.name}. Teď skenujte majetek.` });
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
      setError("Tento štítek zatím nepatří žádné položce v evidenci.");
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
    setStatus(null);

    let keepLock = false;
    try {
      let res: Response;
      try {
        res = await fieldFetch(`/api/equipment/lookup?code=${encodeURIComponent(code)}`);
      } catch (e) {
        setError(
          e instanceof FieldFetchTimeoutError
            ? "Server neodpovídá. Oddalte kameru a naskenujte kód znovu."
            : "Spojení se serverem selhalo. Oddalte kameru a naskenujte kód znovu."
        );
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
          // Čtvercový náhled: na výšku telefonu zůstane stav nad kamerou i tlačítka pod ní na obrazovce.
          { fps: 8, qrbox: { width: 240, height: 240 }, aspectRatio: 1 },
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
      // Bez clear(): ten hledá kontejner podle id až při volání a po rychlém návratu
      // na stránku by vymazal náhled nové kamery. Starý kontejner odstraní React.
      if (s && started) {
        void started.then(() => s.stop()).catch(() => undefined);
      }
    };
  }, []);

  const pick = (result: LookupResult) => {
    setChoice(null);
    const keepLock = applyResult(result);
    if (!keepLock) busyRef.current = false;
  };

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

      {room ? (
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
              setStatus(null);
              busyRef.current = false;
              gateRef.current.reset();
            }}
          >
            Změnit
          </button>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          Nejdřív naskenujte QR místnosti, potom QR majetku. Místnost zůstane nastavená, další kusy jdou
          za sebou. Před uložením se zeptáme na potvrzení.
        </p>
      )}

      {status ? (
        <div
          role={status.tone === "error" ? "alert" : "status"}
          className={`flex items-start gap-2 rounded-lg border p-3 text-sm ${
            status.tone === "error"
              ? "border-primary/40 font-medium text-primary dark:text-destructive"
              : "border-border"
          }`}
        >
          {status.tone === "error" ? (
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          ) : status.tone === "success" ? (
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-(--success)" aria-hidden />
          ) : (
            <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          )}
          <span className="min-w-0 flex-1">
            {status.text}
            {status.protocolUrl ? (
              <a href={status.protocolUrl} className="flex min-h-11 items-center font-medium underline">
                Tisk protokolu
              </a>
            ) : null}
          </span>
        </div>
      ) : null}

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
            className="min-h-11 min-w-0 flex-1 rounded-lg border border-border bg-background px-3 font-mono"
            placeholder={EQUIPMENT_MANUAL_CODE_PLACEHOLDER_WITH_ROOM}
            value={manual}
            onChange={(e) => setManual(e.target.value)}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="characters"
            spellCheck={false}
          />
          <button type="submit" className="min-h-11 rounded-lg bg-primary px-4 font-medium text-primary-foreground">
            OK
          </button>
        </div>
        <p className="text-xs text-muted-foreground">{EQUIPMENT_MANUAL_CODE_HINT_WITH_ROOM}</p>
      </form>

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
          <div className="space-y-3">
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
            <MovementNotifyCheckbox checked={notify} onChange={setNotify} />
          </div>
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
