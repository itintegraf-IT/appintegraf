"use client";

import { useState, useMemo, useEffect } from "react";
import {
  ORDER_EXPORT_FIELDS,
  ORDER_EXPORT_FIELD_LABELS,
  type OrderExportField,
} from "@/lib/iml-order-export-fields";

const DEFAULT_FIELDS: OrderExportField[] = [
  "order_number",
  "customer_name",
  "order_date",
  "expected_ship_date",
  "status",
  "total",
  "items_summary",
];

type Customer = { id: number; name: string };

export type ExportModalMode = "bulk" | "single";

type Props = {
  open: boolean;
  onClose: () => void;
  mode: ExportModalMode;
  /** Jedna objednávka (režim single) */
  singleOrder?: { id: number; order_number: string } | null;
  /** Předvyplnění filtrů hromadného exportu z přehledu */
  initialCustomerId?: string;
  initialStatus?: string;
};

function safeFilenamePart(s: string): string {
  return s.replace(/[/\\:*?"<>|]/g, "_").trim() || "objednavka";
}

export function ImlVariableExportModal({
  open,
  onClose,
  mode,
  singleOrder,
  initialCustomerId = "",
  initialStatus = "",
}: Props) {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [modalCustomer, setModalCustomer] = useState("");
  const [modalStatus, setModalStatus] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [selected, setSelected] = useState<Set<OrderExportField>>(() => new Set(DEFAULT_FIELDS));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (!open || mode !== "bulk") return;
    fetch("/api/iml/customers")
      .then((r) => r.json())
      .then((d) => setCustomers(d.customers ?? []))
      .catch(() => setCustomers([]));
  }, [open, mode]);

  useEffect(() => {
    if (!open) return;
    setErr("");
    if (mode === "bulk") {
      setModalCustomer(initialCustomerId);
      setModalStatus(initialStatus);
      setDateFrom("");
      setDateTo("");
    }
    setSelected(new Set(DEFAULT_FIELDS));
  }, [open, mode, initialCustomerId, initialStatus]);

  const toggle = (f: OrderExportField) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(f)) next.delete(f);
      else next.add(f);
      return next;
    });
  };

  const fieldsList = useMemo(() => [...selected], [selected]);

  const buildBody = (format: "csv" | "xlsx" | "xml") => {
    const base = { format, fields: fieldsList };
    if (mode === "single" && singleOrder) {
      return { ...base, order_id: singleOrder.id };
    }
    return {
      ...base,
      customer_id: modalCustomer.trim() || undefined,
      status: modalStatus.trim() || undefined,
      order_date_from: dateFrom.trim() || undefined,
      order_date_to: dateTo.trim() || undefined,
    };
  };

  const download = async (format: "csv" | "xlsx" | "xml") => {
    setErr("");
    if (mode === "single" && !singleOrder) {
      setErr("Chybí objednávka.");
      return;
    }
    if (fieldsList.length === 0) {
      setErr("Vyberte alespoň jedno pole.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/iml/orders/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildBody(format)),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setErr(j.error ?? `Chyba ${res.status}`);
        return;
      }
      const blob = await res.blob();
      const ext = format === "xlsx" ? "xlsx" : format === "xml" ? "xml" : "csv";
      const baseName =
        mode === "single" && singleOrder
          ? `iml-objednavka-${safeFilenamePart(singleOrder.order_number)}`
          : "iml-objednavky-vyber";
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${baseName}.${ext}`;
      a.click();
      URL.revokeObjectURL(url);
      onClose();
    } catch {
      setErr("Chyba při stahování souboru.");
    } finally {
      setBusy(false);
    }
  };

  if (!open) return null;

  const title =
    mode === "single"
      ? `Export objednávky ${singleOrder?.order_number ?? ""}`
      : "Export objednávek";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div
        className="max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-xl border border-gray-200 bg-white p-6 shadow-xl"
        role="dialog"
        aria-labelledby="export-modal-title"
      >
        <h2 id="export-modal-title" className="text-lg font-semibold text-gray-900">
          {title}
        </h2>
        <p className="mt-1 text-sm text-gray-600">
          {mode === "single"
            ? "Zaškrtněte pole, která mají být v souboru (data z detailu objednávky v exportním formátu)."
            : "Zvolte filtry (volitelně), pole a formát (CSV / Excel / XML). Bez filtru až 2000 objednávek."}
        </p>

        {mode === "bulk" && (
          <div className="mt-4 space-y-3 rounded-lg border border-gray-100 bg-gray-50/80 p-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Zákazník</label>
              <select
                value={modalCustomer}
                onChange={(e) => setModalCustomer(e.target.value)}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
              >
                <option value="">Všichni zákazníci</option>
                {customers.map((c) => (
                  <option key={c.id} value={String(c.id)}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Stav objednávky</label>
              <select
                value={modalStatus}
                onChange={(e) => setModalStatus(e.target.value)}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
              >
                <option value="">Všechny stavy</option>
                <option value="nová">Nová</option>
                <option value="potvrzená">Potvrzená</option>
                <option value="odeslaná">Odeslaná</option>
                <option value="dokončená">Dokončená</option>
                <option value="zrušená">Zrušená</option>
              </select>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">Datum přijetí od</label>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">Datum přijetí do</label>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
                />
              </div>
            </div>
          </div>
        )}

        {err && <p className="mt-3 text-sm text-red-600">{err}</p>}

        <p className="mt-4 text-xs font-medium uppercase tracking-wide text-gray-500">Pole v souboru</p>
        <div className="mt-2 grid max-h-[38vh] gap-1.5 overflow-y-auto rounded-lg border border-gray-100 p-3">
          {ORDER_EXPORT_FIELDS.map((f) => (
            <label
              key={f}
              className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-gray-50"
            >
              <input
                type="checkbox"
                checked={selected.has(f)}
                onChange={() => toggle(f)}
                className="rounded border-gray-300"
              />
              <span className="font-mono text-xs text-gray-500">{f}</span>
              <span className="text-gray-800">{ORDER_EXPORT_FIELD_LABELS[f]}</span>
            </label>
          ))}
        </div>

        <div className="mt-6 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => download("csv")}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
          >
            CSV
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => download("xlsx")}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            Excel
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => download("xml")}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            XML
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onClose}
            className="ml-auto rounded-lg px-4 py-2 text-sm text-gray-600 hover:bg-gray-100"
          >
            Zavřít
          </button>
        </div>
      </div>
    </div>
  );
}
