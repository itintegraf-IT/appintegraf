"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import type { MaketyProductDraft } from "@/lib/makety-product-draft";

type Props = {
  maketaId: number;
  canOperate: boolean;
  /** Panel je pro schválená data → produkt IML. */
  status: string;
  hasCustomer: boolean;
  hasProduct: boolean;
  imlApplied: boolean;
};

export function GrafikaAutomationPanel({
  maketaId,
  canOperate,
  status,
  hasCustomer,
  hasProduct,
  imlApplied,
}: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [draft, setDraft] = useState<MaketyProductDraft | null>(null);
  const [draftOpen, setDraftOpen] = useState(false);
  const [draftMeta, setDraftMeta] = useState<{
    customerName: string | null;
    dieCutLabel: string | null;
  } | null>(null);
  const autoOpened = useRef(false);

  const pendingIml = canOperate && status === "approved" && !imlApplied;

  const onPrepareDraft = useCallback(async () => {
    setBusy("draft");
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(`/api/makety/${maketaId}/prepare-product-draft`, {
        method: "POST",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Příprava selhala");
        setBusy(null);
        return;
      }
      setDraft(data.draft as MaketyProductDraft);
      setDraftMeta({
        customerName: data.customerName ?? null,
        dieCutLabel: data.dieCutLabel ?? null,
      });
      setDraftOpen(true);
    } catch {
      setError("Síťová chyba");
    }
    setBusy(null);
  }, [maketaId]);

  useEffect(() => {
    if (!pendingIml || autoOpened.current || !hasCustomer) return;
    autoOpened.current = true;
    void onPrepareDraft();
  }, [pendingIml, hasCustomer, onPrepareDraft]);

  if (!canOperate || status !== "approved") return null;

  const onApplyDraft = async () => {
    if (!draft) return;
    setBusy("apply");
    setError(null);
    try {
      const res = await fetch(`/api/makety/${maketaId}/apply-product-draft`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Uložení selhalo");
        if (data.draft) setDraft(data.draft as MaketyProductDraft);
        setBusy(null);
        return;
      }
      setDraftOpen(false);
      setDraft(null);
      const fileInfo = data.files as
        | {
            softproofAttached?: boolean;
            printDataAttached?: boolean;
            warnings?: string[];
          }
        | undefined;
      const transferred: string[] = [];
      if (fileInfo?.softproofAttached) transferred.push("softproof");
      if (fileInfo?.printDataAttached) transferred.push("tisková data");
      const transferNote =
        transferred.length > 0 ? ` Přeneseno: ${transferred.join(", ")}.` : "";
      const warnNote =
        fileInfo?.warnings?.length && transferred.length === 0
          ? ` Varování: ${fileInfo.warnings.join("; ")}`
          : fileInfo?.warnings?.length
            ? ` ${fileInfo.warnings.join("; ")}`
            : "";
      setMessage(
        (data.mode === "update"
          ? `Produkt #${data.productId} aktualizován. Zakázka je v archivu.`
          : `Produkt #${data.productId} založen. Zakázka je v archivu.`) +
          transferNote +
          warnNote
      );
      router.refresh();
    } catch {
      setError("Síťová chyba");
    }
    setBusy(null);
  };

  if (imlApplied) {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5 shadow-sm dark:border-emerald-800 dark:bg-emerald-950/40">
        <h3 className="text-sm font-semibold text-emerald-900 dark:text-emerald-100">Produkt v IML</h3>
        <p className="mt-1 text-xs text-emerald-800 dark:text-emerald-200">
          Záznam v IML je potvrzený, zakázka je v archivu.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-amber-300 bg-amber-50 p-5 shadow-sm dark:border-amber-800 dark:bg-amber-950/40">
      <h3 className="text-sm font-semibold text-amber-950 dark:text-amber-100">Zápis do IML</h3>
      <p className="mt-1 text-xs text-amber-900 dark:text-amber-200">
        Zakázka je interně schválená. Zůstane v aktivním přehledu, dokud nepřijmete založení
        nebo aktualizaci záznamu v IML.
      </p>

      {error && (
        <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/50 dark:text-red-200">
          {error}
        </p>
      )}
      {message && (
        <p className="mt-3 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200">
          {message}
        </p>
      )}

      <div className="mt-4 space-y-2">
        {!hasCustomer && (
          <p className="text-xs text-amber-800 dark:text-amber-200">
            Nejprve přiřaďte klienta (a ideálně kód etikety / vazbu na produkt) u zakázky.
          </p>
        )}
        <button
          type="button"
          onClick={() => void onPrepareDraft()}
          disabled={busy != null || !hasCustomer}
          className="rounded-lg border border-amber-400 bg-white px-4 py-2 text-sm font-medium text-amber-950 hover:bg-amber-100 disabled:opacity-50 dark:border-amber-700 dark:bg-amber-900/40 dark:text-amber-50"
        >
          {busy === "draft"
            ? "Připravuji…"
            : hasProduct
              ? "Založit / aktualizovat záznam v IML"
              : "Založit záznam v IML"}
        </button>
      </div>

      {draftOpen && draft && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-5 shadow-xl dark:bg-gray-900">
            <h4 className="text-base font-semibold text-gray-900 dark:text-gray-100">
              {draft.mode === "update"
                ? "Aktualizovat záznam v IML"
                : "Založit záznam v IML"}
            </h4>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Přijmout zapíše produkt do katalogu a přesune zakázku do archivu. Odmítnout zápis
              přeskočí — zakázka zůstane aktivní a dialog lze zopakovat.
            </p>

            <dl className="mt-4 space-y-3 text-sm">
              <div>
                <dt className="text-xs font-medium uppercase text-gray-500">Klient</dt>
                <dd className="mt-0.5 text-gray-900 dark:text-gray-100">
                  {draftMeta?.customerName ?? draft.client_name ?? draft.customer_id ?? "—"}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase text-gray-500">Výsek</dt>
                <dd className="mt-0.5 text-gray-900 dark:text-gray-100">
                  {draftMeta?.dieCutLabel ?? "—"}
                </dd>
              </div>
              <label className="block">
                <span className="text-xs font-medium uppercase text-gray-500">IG kód</span>
                <input
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 dark:border-gray-600 dark:bg-gray-800"
                  value={draft.ig_code ?? ""}
                  onChange={(e) =>
                    setDraft({ ...draft, ig_code: e.target.value || null })
                  }
                />
              </label>
              <label className="block">
                <span className="text-xs font-medium uppercase text-gray-500">
                  Kód klienta
                </span>
                <input
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 dark:border-gray-600 dark:bg-gray-800"
                  value={draft.client_code ?? ""}
                  onChange={(e) =>
                    setDraft({ ...draft, client_code: e.target.value || null })
                  }
                />
              </label>
              <label className="block">
                <span className="text-xs font-medium uppercase text-gray-500">
                  Název u klienta
                </span>
                <input
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 dark:border-gray-600 dark:bg-gray-800"
                  value={draft.client_name ?? ""}
                  onChange={(e) =>
                    setDraft({ ...draft, client_name: e.target.value || null })
                  }
                />
              </label>
              <label className="block">
                <span className="text-xs font-medium uppercase text-gray-500">
                  Krátký název
                </span>
                <input
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 dark:border-gray-600 dark:bg-gray-800"
                  value={draft.ig_short_name ?? ""}
                  onChange={(e) =>
                    setDraft({ ...draft, ig_short_name: e.target.value || null })
                  }
                />
              </label>
              <label className="block">
                <span className="text-xs font-medium uppercase text-gray-500">
                  Poznámka výroby
                </span>
                <textarea
                  rows={4}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 dark:border-gray-600 dark:bg-gray-800"
                  value={draft.production_notes ?? ""}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      production_notes: e.target.value || null,
                    })
                  }
                />
              </label>
            </dl>

            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm dark:border-gray-600"
                onClick={() => setDraftOpen(false)}
                disabled={busy != null}
              >
                Odmítnout
              </button>
              <button
                type="button"
                className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-50"
                onClick={() => void onApplyDraft()}
                disabled={busy != null}
              >
                {busy === "apply" ? "Ukládám…" : "Přijmout"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
