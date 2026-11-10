"use client";

import { useCallback, useState } from "react";
import { ChevronDown, ChevronRight, History, Loader2 } from "lucide-react";

type ActivityItem = {
  id: number;
  action: string;
  table_name: string | null;
  record_id: number | null;
  created_at: string;
  userName: string | null;
  old_values: unknown;
  new_values: unknown;
};

const PAGE_SIZE = 50;

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("cs-CZ", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function summaryFromValues(values: unknown): string {
  if (values == null) return "";
  if (typeof values !== "object" || Array.isArray(values)) {
    return String(values).slice(0, 120);
  }
  const o = values as Record<string, unknown>;
  const parts: string[] = [];
  if (o.audit_action != null) parts.push(String(o.audit_action));
  if (o.reason != null) parts.push(`reason: ${String(o.reason)}`);
  if (o.item_status != null) parts.push(`stav: ${String(o.item_status)}`);
  if (o.version != null) parts.push(`v${String(o.version)}`);
  if (o.filename != null) parts.push(String(o.filename));
  if (o.file_size != null) parts.push(`${String(o.file_size)} B`);
  if (o.product_id != null && parts.length === 0) {
    parts.push(`product #${String(o.product_id)}`);
  }
  if (o.ig_code != null) parts.push(`IG: ${String(o.ig_code)}`);
  if (o.image_uploaded === true) parts.push("softproof nahrán");
  if (o.image_deleted === true) parts.push("softproof smazán");
  if (o.thumbnail_source != null) parts.push(`thumb: ${String(o.thumbnail_source)}`);
  if (parts.length === 0) {
    const keys = Object.keys(o).slice(0, 4);
    return keys.map((k) => `${k}=${JSON.stringify(o[k])}`).join(", ").slice(0, 140);
  }
  return parts.join(" · ");
}

function JsonBlock({ label, value }: { label: string; value: unknown }) {
  if (value == null) {
    return (
      <div className="text-xs text-gray-500">
        <span className="font-medium text-gray-600">{label}:</span> —
      </div>
    );
  }
  const text =
    typeof value === "string" ? value : JSON.stringify(value, null, 2);
  return (
    <div>
      <div className="mb-0.5 text-xs font-medium text-gray-600">{label}</div>
      <pre className="max-h-48 overflow-auto rounded border border-gray-200 bg-white p-2 text-[11px] leading-snug text-gray-800">
        {text}
      </pre>
    </div>
  );
}

function ActivityRow({ item }: { item: ActivityItem }) {
  const [open, setOpen] = useState(false);
  const summary = summaryFromValues(item.new_values) || summaryFromValues(item.old_values);

  return (
    <li className="border-t border-gray-100">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-start gap-2 px-3 py-2.5 text-left hover:bg-gray-50"
      >
        <span className="mt-0.5 text-gray-400">
          {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <span className="text-xs tabular-nums text-gray-500">
              {formatDate(item.created_at)}
            </span>
            <span className="text-sm font-medium text-gray-900">
              {item.userName ?? "—"}
            </span>
            <span className="font-mono text-xs text-violet-800">{item.action}</span>
          </span>
          {summary ? (
            <span className="mt-0.5 block truncate text-xs text-gray-600">{summary}</span>
          ) : null}
        </span>
      </button>
      {open && (
        <div className="space-y-2 bg-gray-50/80 px-3 pb-3 pl-9">
          <JsonBlock label="old_values" value={item.old_values} />
          <JsonBlock label="new_values" value={item.new_values} />
        </div>
      )}
    </li>
  );
}

export default function ProductAuditTrail({ productId }: { productId: number }) {
  const [expanded, setExpanded] = useState(false);
  const [items, setItems] = useState<ActivityItem[]>([]);
  const [total, setTotal] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  const fetchPage = useCallback(
    async (offset: number, append: boolean) => {
      if (append) setLoadingMore(true);
      else setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({
          limit: String(PAGE_SIZE),
          offset: String(offset),
        });
        const res = await fetch(
          `/api/iml/products/${productId}/activity?${params}`,
          { cache: "no-store" }
        );
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError(typeof data.error === "string" ? data.error : "Načtení selhalo");
          return;
        }
        const next = Array.isArray(data.items) ? (data.items as ActivityItem[]) : [];
        setTotal(typeof data.total === "number" ? data.total : next.length);
        setItems((prev) => (append ? [...prev, ...next] : next));
        setLoaded(true);
      } catch {
        setError("Síťová chyba při načítání auditu");
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [productId]
  );

  const onToggle = () => {
    const next = !expanded;
    setExpanded(next);
    if (next && !loaded && !loading) {
      void fetchPage(0, false);
    }
  };

  return (
    <div className="mt-6 rounded-xl border border-gray-200 bg-white">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-2 px-4 py-3 text-left hover:bg-gray-50"
      >
        <History className="h-4 w-4 text-gray-500" />
        <span className="flex-1 text-sm font-semibold text-gray-800">
          Podrobná auditní stopa
          {total != null ? (
            <span className="ml-1.5 font-normal text-gray-500">({total})</span>
          ) : null}
        </span>
        {expanded ? (
          <ChevronDown className="h-4 w-4 text-gray-400" />
        ) : (
          <ChevronRight className="h-4 w-4 text-gray-400" />
        )}
      </button>

      {expanded && (
        <div className="border-t border-gray-200">
          {loading && (
            <div className="flex items-center gap-2 px-4 py-6 text-sm text-gray-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              Načítám audit…
            </div>
          )}
          {error && (
            <div className="mx-3 my-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}
          {!loading && !error && loaded && items.length === 0 && (
            <div className="px-4 py-6 text-sm text-gray-500">
              Žádné auditní záznamy pro tento produkt.
            </div>
          )}
          {!loading && items.length > 0 && (
            <ul className="max-h-[28rem] overflow-y-auto">
              {items.map((item) => (
                <ActivityRow key={item.id} item={item} />
              ))}
            </ul>
          )}
          {!loading && total != null && items.length < total && (
            <div className="border-t border-gray-100 px-4 py-3">
              <button
                type="button"
                disabled={loadingMore}
                onClick={() => void fetchPage(items.length, true)}
                className="text-sm font-medium text-violet-700 hover:underline disabled:opacity-50"
              >
                {loadingMore ? "Načítám…" : `Načíst další (${items.length} / ${total})`}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
