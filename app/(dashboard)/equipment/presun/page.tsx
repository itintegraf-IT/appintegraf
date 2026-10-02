"use client";

import { useState } from "react";
import Link from "next/link";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import {
  EQUIPMENT_MANUAL_CODE_HINT,
  EQUIPMENT_MANUAL_CODE_PLACEHOLDER,
} from "../_components/EquipmentCodeBadge";
import { MovementNotifyCheckbox, useMovementNotifyPreference } from "../_components/MovementNotifyCheckbox";
import { FieldFetchTimeoutError, fieldFetch, fieldFetchErrorMessage } from "@/lib/equipment/field-fetch";

type Item = { id: number; name: string; asset_tag?: string | null; room?: { id: number } | null };
type Status = { tone: "error" | "success"; text: string; protocolUrl?: string } | null;

const fieldClass = "min-h-11 w-full rounded-lg border border-border bg-background px-3";

export default function PresunPage() {
  const [code, setCode] = useState("");
  const [item, setItem] = useState<Item | null>(null);
  const [rooms, setRooms] = useState<{ id: number; name: string; code: string }[]>([]);
  const [toRoom, setToRoom] = useState("");
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState<Status>(null);
  const [searching, setSearching] = useState(false);
  const [moving, setMoving] = useState(false);
  const [notify, setNotify] = useMovementNotifyPreference();

  const lookup = async () => {
    if (!code.trim() || searching) return;
    setStatus(null);
    setSearching(true);
    try {
      const res = await fieldFetch(`/api/equipment/lookup?code=${encodeURIComponent(code.trim())}&target=item`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.type !== "item") {
        setStatus({ tone: "error", text: data.error ?? "Položka nenalezena." });
        setItem(null);
        return;
      }
      setItem(data);
      if (rooms.length === 0) {
        const r = await fieldFetch("/api/equipment/rooms");
        const roomList = await r.json().catch(() => []);
        setRooms(Array.isArray(roomList) ? roomList : []);
      }
    } catch (e) {
      setStatus({
        tone: "error",
        text:
          e instanceof FieldFetchTimeoutError
            ? "Server neodpovídá. Zkuste položku vyhledat znovu."
            : "Spojení se serverem selhalo. Zkuste položku vyhledat znovu.",
      });
    } finally {
      setSearching(false);
    }
  };

  const transfer = async () => {
    if (!item || !toRoom || moving) return;
    setStatus(null);
    setMoving(true);
    try {
      const res = await fieldFetch("/api/equipment/transfers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ equipment_id: item.id, to_room_id: parseInt(toRoom, 10), notes, notify }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setStatus({ tone: "error", text: data.error ?? "Přesun se nepodařil." });
        return;
      }
      const target = rooms.find((r) => String(r.id) === toRoom);
      setStatus({
        tone: "success",
        text: `Přesunuto: ${item.name}${target ? ` → ${target.code} – ${target.name}` : ""}.`,
        protocolUrl: data.protocolUrl || undefined,
      });
      // Formulář je připravený na další kus (a druhé ťuknutí nic nepošle).
      setItem(null);
      setCode("");
      setToRoom("");
      setNotes("");
    } catch (e) {
      setStatus({ tone: "error", text: fieldFetchErrorMessage(e) });
    } finally {
      setMoving(false);
    }
  };

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Přesun majetku</h1>
        <Link href="/equipment" className="inline-flex min-h-11 items-center rounded-lg border border-border px-3 text-sm hover:bg-muted">
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
        <label htmlFor="presun-code" className="block text-sm font-medium">
          Inventární č. / kód
        </label>
        <div className="flex gap-2">
          <input
            id="presun-code"
            className={`${fieldClass} min-w-0 flex-1 font-mono`}
            placeholder={EQUIPMENT_MANUAL_CODE_PLACEHOLDER}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="characters"
            spellCheck={false}
          />
          <button
            type="submit"
            disabled={searching}
            className="min-h-11 rounded-lg bg-primary px-4 font-medium text-primary-foreground disabled:opacity-50"
          >
            {searching ? "Hledám…" : "Najít"}
          </button>
        </div>
        <p className="text-xs text-muted-foreground">{EQUIPMENT_MANUAL_CODE_HINT}</p>
      </form>

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
          ) : (
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-(--success)" aria-hidden />
          )}
          <span className="min-w-0 flex-1">
            {status.text}
            {status.protocolUrl ? (
              <>
                {" "}
                <a href={status.protocolUrl} className="font-medium underline">
                  Tisk protokolu
                </a>
              </>
            ) : null}
          </span>
        </div>
      ) : null}

      {item ? (
        <div className="space-y-3 rounded-xl border border-border bg-card p-4">
          <p className="font-medium">
            {item.name}
            {item.asset_tag ? <span className="ml-2 font-mono text-sm text-muted-foreground">{item.asset_tag}</span> : null}
          </p>
          <label htmlFor="presun-room" className="block text-sm font-medium">
            Cílová místnost
          </label>
          <select id="presun-room" className={fieldClass} value={toRoom} onChange={(e) => setToRoom(e.target.value)}>
            <option value="">— Vyberte místnost —</option>
            {rooms.map((r) => (
              <option key={r.id} value={r.id}>
                {r.code} – {r.name}
              </option>
            ))}
          </select>
          <label htmlFor="presun-notes" className="block text-sm font-medium">
            Poznámka
          </label>
          <textarea
            id="presun-notes"
            className="w-full rounded-lg border border-border bg-background px-3 py-2"
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
          <MovementNotifyCheckbox checked={notify} onChange={setNotify} />
          <button
            type="button"
            disabled={!toRoom || moving}
            onClick={() => void transfer()}
            className="min-h-11 rounded-lg bg-primary px-4 font-medium text-primary-foreground disabled:opacity-50"
          >
            {moving ? "Přesouvám…" : "Přesunout"}
          </button>
        </div>
      ) : null}
    </div>
  );
}
