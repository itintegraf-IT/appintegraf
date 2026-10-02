"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { AlertCircle, AlertTriangle, CheckCircle2, Circle, Info, XCircle } from "lucide-react";
import {
  EQUIPMENT_MANUAL_CODE_HINT,
  EQUIPMENT_MANUAL_CODE_PLACEHOLDER,
} from "../_components/EquipmentCodeBadge";
import { EquipmentDialog } from "../_components/EquipmentDialog";
import { fieldFetch, fieldFetchErrorMessage } from "@/lib/equipment/field-fetch";
import { summarizeInventoryLines } from "@/lib/equipment/inventory-rules";
import {
  INVENTORY_SCOPE_LABELS,
  INVENTORY_STATUS_LABELS,
  inventoryLineLabel,
  itemsCountLabel,
  type StatusTone,
} from "@/lib/equipment/inventory-status";

type Inv = {
  id: number;
  name: string;
  status: string;
  scope_type: string;
  _count: { lines: number };
};
type Line = {
  id: number;
  line_status: string;
  equipment_items: { name: string; asset_tag: string | null };
};
type Detail = { id: number; name: string; status: string; lines: Line[] };
type Feedback = { tone: "success" | "error" | "info"; text: string } | null;

const LOAD_ERROR = "Inventuru se nepodařilo načíst. Zkontrolujte připojení a zkuste to znovu.";
const errorTextClass = "flex items-start gap-2 text-sm font-medium text-primary dark:text-destructive";

function ToneIcon({ tone }: { tone: StatusTone }) {
  const cls = "h-4 w-4 shrink-0";
  if (tone === "success") return <CheckCircle2 className={`${cls} text-(--success)`} aria-hidden />;
  if (tone === "danger") return <XCircle className={`${cls} text-primary dark:text-destructive`} aria-hidden />;
  if (tone === "warning") return <AlertTriangle className={cls} aria-hidden />;
  return <Circle className={`${cls} text-muted-foreground`} aria-hidden />;
}

type Props = {
  /** Smí založit inventuru místnosti (správa evidence). */
  canManageRegister: boolean;
  /** Smí založit celofiremní inventuru (správce modulu). */
  canAdminister: boolean;
};

export function InventuraClient({ canManageRegister, canAdminister }: Props) {
  const [list, setList] = useState<Inv[]>([]);
  const [name, setName] = useState("");
  const [scope, setScope] = useState<"room" | "category" | "all">(canManageRegister ? "room" : "category");
  const [cats, setCats] = useState<{ id: number; name: string }[]>([]);
  const [rooms, setRooms] = useState<{ id: number; name: string; code: string }[]>([]);
  const [scopeId, setScopeId] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");
  const [activeId, setActiveId] = useState<number | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");
  const [scanCode, setScanCode] = useState("");
  const [scanning, setScanning] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [closeOpen, setCloseOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  const [closeError, setCloseError] = useState("");
  /** Naposledy vyžádaná inventura — pozdní odpověď dříve vybrané inventury se zahodí. */
  const requestedIdRef = useRef<number | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  const load = () => {
    fieldFetch("/api/equipment/inventories")
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => setList(Array.isArray(d) ? d : []))
      .catch(() => setCreateError("Seznam inventur se nepodařilo načíst. Obnovte stránku."));
  };

  useEffect(() => {
    load();
    fetch("/api/equipment/categories?for=write")
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => setCats(Array.isArray(d) ? d : []))
      .catch(() => undefined);
    fetch("/api/equipment/rooms")
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => setRooms(Array.isArray(d) ? d : []))
      .catch(() => undefined);
  }, []);

  /** Načte detail. `silent` = obnovení po skenu (chybu hlásí volající). Vrací false při chybě. */
  const fetchDetail = async (id: number, silent = false): Promise<boolean> => {
    try {
      const res = await fieldFetch(`/api/equipment/inventories/${id}`);
      const data = await res.json().catch(() => ({}));
      if (requestedIdRef.current !== id) return true;
      if (!res.ok) {
        if (!silent) setDetailError(data.error ?? LOAD_ERROR);
        return false;
      }
      setDetail(data);
      setDetailError("");
      return true;
    } catch {
      if (!silent && requestedIdRef.current === id) setDetailError(LOAD_ERROR);
      return false;
    }
  };

  /** Výběr inventury: starý detail hned zmizí — sken ani uzavření nesmí jít na jinou, než je vidět. */
  const selectInventory = async (id: number, message: Feedback = null) => {
    requestedIdRef.current = id;
    setActiveId(id);
    setDetail(null);
    setDetailError("");
    setFeedback(message);
    setScanCode("");
    setDetailLoading(true);
    await fetchDetail(id);
    if (requestedIdRef.current === id) {
      setDetailLoading(false);
      requestAnimationFrame(() => cardRef.current?.scrollIntoView({ block: "start" }));
    }
  };

  const canCreate = scope === "all" || scopeId !== "";

  const create = async () => {
    if (!canCreate || creating) return;
    setCreating(true);
    setCreateError("");
    try {
      const res = await fieldFetch("/api/equipment/inventories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name || undefined, scope_type: scope, scope_id: scopeId || null }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 409 && data.existingId) {
        await selectInventory(data.existingId, {
          tone: "info",
          text: "Pro tento rozsah už inventura probíhá — otevřeli jsme ji.",
        });
        return;
      }
      if (!res.ok) {
        setCreateError(data.error ?? "Inventuru se nepodařilo založit.");
        return;
      }
      load();
      await selectInventory(data.id);
    } catch (e) {
      setCreateError(fieldFetchErrorMessage(e));
    } finally {
      setCreating(false);
    }
  };

  const scan = async () => {
    if (!detail || detail.status === "completed" || !scanCode.trim() || scanning) return;
    const id = detail.id;
    setScanning(true);
    try {
      const res = await fieldFetch(`/api/equipment/inventories/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "scan", code: scanCode.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setFeedback({ tone: "error", text: data.error ?? "Sken se nepodařilo uložit." });
        return;
      }
      const label = inventoryLineLabel(data.lineStatus, false).label;
      setFeedback({
        tone: "success",
        text: data.alreadyScanned ? `${data.name}: už naskenováno (${label})` : `${data.name}: ${label}`,
      });
      setScanCode("");
      if (!(await fetchDetail(id, true))) {
        setFeedback({
          tone: "error",
          text: `${data.name}: sken je uložený, ale seznam se nepodařilo obnovit. Obnovte stránku.`,
        });
      }
    } catch (e) {
      setFeedback({ tone: "error", text: fieldFetchErrorMessage(e) });
    } finally {
      setScanning(false);
    }
  };

  const complete = async () => {
    if (!detail) return;
    const { id, name: closedName } = detail;
    setClosing(true);
    setCloseError("");
    try {
      const res = await fieldFetch(`/api/equipment/inventories/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "complete" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setCloseError(data.error ?? "Inventuru se nepodařilo uzavřít.");
        return;
      }
      // Server uzavření potvrdil — karta to ukáže hned, i kdyby obnovení seznamu selhalo.
      setDetail((prev) => (prev && prev.id === id ? { ...prev, status: "completed" } : prev));
      setCloseOpen(false);
      setFeedback({ tone: "success", text: `Inventura „${closedName}“ je uzavřená.` });
      load();
      if (!(await fetchDetail(id, true))) {
        setFeedback({
          tone: "success",
          text: `Inventura „${closedName}“ je uzavřená. Seznam se nepodařilo obnovit — obnovte stránku.`,
        });
      }
    } catch (e) {
      setCloseError(fieldFetchErrorMessage(e));
    } finally {
      setClosing(false);
    }
  };

  const completed = detail?.status === "completed";
  const summary = useMemo(() => summarizeInventoryLines(detail?.lines ?? []), [detail]);
  const shown = detail && detail.id === activeId ? detail : null;

  return (
    <div className="space-y-6">
      <div className="flex justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Inventura</h1>
          <p className="text-muted-foreground">Seznam položek místnosti nebo skupiny — každou naskenujte.</p>
        </div>
        <Link href="/equipment" className="inline-flex min-h-11 items-center rounded-lg border border-border px-3 text-sm hover:bg-muted">
          Zpět
        </Link>
      </div>

      <div className="space-y-3 rounded-xl border border-border bg-card p-4">
        <label htmlFor="inv-name" className="block text-sm font-medium">
          Název inventury
        </label>
        <input
          id="inv-name"
          className="min-h-11 w-full rounded-lg border border-border bg-background px-3"
          placeholder="např. Kancelář DTP – říjen"
          maxLength={200}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <label htmlFor="inv-scope" className="block text-sm font-medium">
          Rozsah
        </label>
        <select
          id="inv-scope"
          className="min-h-11 w-full rounded-lg border border-border bg-background px-3"
          value={scope}
          onChange={(e) => {
            setScope(e.target.value as typeof scope);
            setScopeId("");
          }}
        >
          {canManageRegister ? <option value="room">Místnost</option> : null}
          <option value="category">Skupina</option>
          {canAdminister ? <option value="all">Celá firma</option> : null}
        </select>
        {scope === "category" ? (
          <select
            aria-label="Skupina"
            className="min-h-11 w-full rounded-lg border border-border bg-background px-3"
            value={scopeId}
            onChange={(e) => setScopeId(e.target.value)}
          >
            <option value="">— Vyberte skupinu —</option>
            {cats.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        ) : null}
        {scope === "room" ? (
          <select
            aria-label="Místnost"
            className="min-h-11 w-full rounded-lg border border-border bg-background px-3"
            value={scopeId}
            onChange={(e) => setScopeId(e.target.value)}
          >
            <option value="">— Vyberte místnost —</option>
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
          disabled={!canCreate || creating}
          className="min-h-11 rounded-lg bg-primary px-4 font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
        >
          {creating ? "Zakládám…" : "Spustit inventuru"}
        </button>
        {createError ? (
          <p role="alert" className={errorTextClass}>
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            {createError}
          </p>
        ) : null}
      </div>

      <ul className="space-y-1 text-sm">
        {list.map((inv) => (
          <li key={inv.id}>
            <button
              type="button"
              aria-current={inv.id === activeId ? "true" : undefined}
              className="min-h-11 text-left text-primary hover:underline aria-[current=true]:font-semibold"
              onClick={() => void selectInventory(inv.id)}
            >
              {inv.name} — {INVENTORY_STATUS_LABELS[inv.status] ?? "Neznámý stav"},{" "}
              {INVENTORY_SCOPE_LABELS[inv.scope_type] ?? "Rozsah"}, {itemsCountLabel(inv._count.lines)}
            </button>
          </li>
        ))}
      </ul>

      {detailError ? (
        <p role="alert" className={errorTextClass}>
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          {detailError}
        </p>
      ) : null}

      {activeId !== null ? (
        <div ref={cardRef} className="scroll-mt-4">
          {shown ? (
            <div className="space-y-4 rounded-xl border border-border bg-card p-4">
              <div>
                <h2 className="text-lg font-semibold">{shown.name}</h2>
                <p className="text-sm text-muted-foreground">
                  {INVENTORY_STATUS_LABELS[shown.status] ?? "Neznámý stav"} · Nalezeno {summary.foundExpected} z{" "}
                  {summary.expected}
                  {summary.unexpected ? ` · evidováno jinde ${summary.unexpected}` : ""}
                  {summary.extra ? ` · navíc ${summary.extra}` : ""}
                </p>
              </div>

              {!completed ? (
                <form
                  className="space-y-1"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void scan();
                  }}
                >
                  <label htmlFor="inv-scan" className="block text-sm font-medium">
                    Sken / ruční kód
                  </label>
                  <div className="flex gap-2">
                    <input
                      id="inv-scan"
                      className="min-h-11 min-w-0 flex-1 rounded-lg border border-border bg-background px-3 font-mono"
                      placeholder={EQUIPMENT_MANUAL_CODE_PLACEHOLDER}
                      value={scanCode}
                      onChange={(e) => setScanCode(e.target.value)}
                      autoComplete="off"
                      autoCorrect="off"
                      autoCapitalize="characters"
                      spellCheck={false}
                    />
                    <button
                      type="submit"
                      disabled={scanning}
                      className="min-h-11 rounded-lg bg-primary px-4 font-medium text-primary-foreground disabled:opacity-50"
                    >
                      {scanning ? "Ukládám…" : "Sken"}
                    </button>
                  </div>
                  <p className="text-xs text-muted-foreground">{EQUIPMENT_MANUAL_CODE_HINT} Potvrďte Enterem.</p>
                </form>
              ) : null}

              {feedback ? (
                <p
                  role={feedback.tone === "error" ? "alert" : "status"}
                  className={`flex items-start gap-2 rounded-lg border p-3 text-sm ${
                    feedback.tone === "error"
                      ? "border-primary/40 font-medium text-primary dark:text-destructive"
                      : "border-border"
                  }`}
                >
                  {feedback.tone === "error" ? (
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                  ) : feedback.tone === "info" ? (
                    <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                  ) : (
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-(--success)" aria-hidden />
                  )}
                  {feedback.text}
                </p>
              ) : null}

              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left text-muted-foreground">
                    <th className="py-1 font-medium">Položka</th>
                    <th className="font-medium">Stav</th>
                  </tr>
                </thead>
                <tbody>
                  {shown.lines.map((l) => {
                    const status = inventoryLineLabel(l.line_status, completed);
                    return (
                      <tr key={l.id} className="border-t border-border">
                        <td className="py-1.5 pr-2">
                          {l.equipment_items.name}{" "}
                          <span className="font-mono text-xs text-muted-foreground">{l.equipment_items.asset_tag}</span>
                        </td>
                        <td>
                          <span className="inline-flex items-center gap-1.5">
                            <ToneIcon tone={status.tone} />
                            {status.label}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {!completed ? (
                <div className="border-t border-border pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setCloseError("");
                      setCloseOpen(true);
                    }}
                    className="min-h-11 rounded-lg border border-border px-4 font-medium hover:bg-muted"
                  >
                    Uzavřít inventuru…
                  </button>
                </div>
              ) : null}
            </div>
          ) : detailLoading ? (
            <p role="status" className="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">
              Načítám inventuru…
            </p>
          ) : null}
        </div>
      ) : null}

      <EquipmentDialog
        open={closeOpen && shown !== null}
        title={`Uzavřít inventuru „${shown?.name ?? ""}“?`}
        destructive
        confirmLabel="Uzavřít inventuru"
        busy={closing}
        onConfirm={() => void complete()}
        onCancel={() => setCloseOpen(false)}
      >
        <p>
          Ze seznamu nalezeno {summary.foundExpected} z {summary.expected}.
          {summary.extra ? ` Navíc naskenováno: ${summary.extra}.` : ""}
        </p>
        <p className="mt-2">
          {summary.missing === 0 ? (
            "Všechny položky ze seznamu jsou naskenované."
          ) : (
            <>
              Bez skenu: {summary.missing} — po uzavření budou vedeny jako <strong>Chybí</strong>.
            </>
          )}{" "}
          Uzavření nelze vrátit.
        </p>
        {closeError ? (
          <p role="alert" className={`mt-3 ${errorTextClass}`}>
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            {closeError}
          </p>
        ) : null}
      </EquipmentDialog>
    </div>
  );
}
