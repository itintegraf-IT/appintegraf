"use client";

import { useCallback, useEffect, useState } from "react";
import { Download, FileSpreadsheet } from "lucide-react";

type Template = {
  id: number;
  name: string;
  format: string;
};

type Props = {
  /** Pokud zadáno, export jen těchto objednávek (přepíše filtry šablony). */
  orderIds?: number[];
  /** Compact button for toolbars */
  variant?: "button" | "menu";
  className?: string;
  label?: string;
  onExported?: () => void;
};

async function downloadOrderTemplateExport(templateId: number, orderIds?: number[]) {
  const body: Record<string, unknown> = { templateId };
  if (orderIds?.length) {
    body.filters = { order_ids: orderIds };
  }
  const res = await fetch("/api/iml/orders/export/run", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(typeof data.error === "string" ? data.error : "Export selhal");
  }
  const blob = await res.blob();
  const cd = res.headers.get("Content-Disposition") ?? "";
  const match = /filename="([^"]+)"/.exec(cd);
  const filename = match?.[1] ?? "iml-objednavky.csv";
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function ImlOrderTemplateExportButton({
  orderIds,
  variant = "button",
  className = "",
  label = "Export šablonou",
  onExported,
}: Props) {
  const [open, setOpen] = useState(false);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/iml/export-templates?entity=orders");
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Načtení šablon selhalo");
        setTemplates([]);
        return;
      }
      setTemplates(data.templates ?? []);
    } catch {
      setError("Síťová chyba");
      setTemplates([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) void load();
  }, [open, load]);

  const run = async (templateId: number) => {
    setBusy(true);
    setError(null);
    try {
      await downloadOrderTemplateExport(templateId, orderIds);
      setOpen(false);
      onExported?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Export selhal");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={`relative inline-block ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={
          variant === "menu"
            ? "rounded p-2 text-gray-600 hover:bg-gray-100"
            : "inline-flex items-center gap-2 rounded-lg border border-violet-300 bg-violet-50 px-3 py-2 text-sm font-medium text-violet-800 hover:bg-violet-100"
        }
        title={label}
      >
        {variant === "menu" ? (
          <FileSpreadsheet className="h-4 w-4" />
        ) : (
          <>
            <Download className="h-4 w-4" />
            {label}
          </>
        )}
      </button>

      {open && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-40 cursor-default"
            aria-label="Zavřít"
            onClick={() => setOpen(false)}
          />
          <div className="absolute right-0 z-50 mt-1 w-72 rounded-xl border border-gray-200 bg-white p-3 shadow-lg">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
              Šablony exportu objednávek
            </p>
            {loading ? (
              <p className="text-sm text-gray-500">Načítám…</p>
            ) : templates.length === 0 ? (
              <p className="text-sm text-gray-600">
                Zatím žádná šablona. Vytvořte ji v{" "}
                <a href="/iml/imports#export" className="font-medium text-violet-700 underline">
                  Import / Export
                </a>
                .
              </p>
            ) : (
              <ul className="max-h-56 space-y-1 overflow-y-auto">
                {templates.map((t) => (
                  <li key={t.id}>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void run(t.id)}
                      className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left text-sm hover:bg-violet-50 disabled:opacity-50"
                    >
                      <span className="truncate font-medium text-gray-900">{t.name}</span>
                      <span className="ml-2 text-xs uppercase text-gray-500">{t.format}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
            <a
              href="/iml/imports#export"
              className="mt-2 block text-xs text-violet-700 hover:underline"
            >
              Spravovat šablony →
            </a>
          </div>
        </>
      )}
    </div>
  );
}
