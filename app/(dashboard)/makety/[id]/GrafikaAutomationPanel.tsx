"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { MaketyProductDraft } from "@/lib/makety-product-draft";
import type { MaketyImlProductConflict } from "@/lib/makety-iml-product-lookup";

type FileTransferInfo = {
  softproofAttached?: boolean;
  printDataAttached?: boolean;
  hadSoftproofOnMaketa?: boolean;
  hadPrintDataOnMaketa?: boolean;
  filesIncomplete?: boolean;
  warnings?: string[];
};

type Props = {
  maketaId: number;
  canOperate: boolean;
  /** Panel je pro schválená data → produkt IML. */
  status: string;
  hasCustomer: boolean;
  hasProduct: boolean;
  imlApplied: boolean;
  /** Po překlopení: chybí ostrá data / softproof v IML oproti maketě. */
  filesIncomplete?: boolean;
  printDataOnProduct?: boolean;
  softproofOnProduct?: boolean;
  hadPrintDataOnMaketa?: boolean;
  hadSoftproofOnMaketa?: boolean;
};

function formatTransferMessage(
  data: {
    files?: FileTransferInfo;
    filesIncomplete?: boolean;
    transferSummary?: string;
    mode?: string;
    replacedExisting?: boolean;
    productId?: number;
  },
  kind: "apply" | "retransfer"
): { text: string; incomplete: boolean } {
  const incomplete = Boolean(data.filesIncomplete ?? data.files?.filesIncomplete);
  const summary =
    (typeof data.transferSummary === "string" && data.transferSummary) ||
    (() => {
      const f = data.files;
      const parts: string[] = [];
      if (f?.softproofAttached) parts.push("softproof");
      if (f?.printDataAttached) parts.push("tisková data");
      let s = parts.length > 0 ? `Přeneseno: ${parts.join(", ")}.` : "Žádný soubor se nepřenesl.";
      if (f?.warnings?.length) s += ` ${f.warnings.join(" ")}`;
      return s;
    })();

  if (kind === "retransfer") {
    return {
      incomplete,
      text: incomplete
        ? `Přenos neúplný. ${summary}`
        : `Soubory znovu přeneseny. ${summary}`,
    };
  }

  const base =
    data.mode === "replace" || data.replacedExisting
      ? `Produkt #${data.productId} aktualizován (existující Kód IG). Zakázka je v archivu.`
      : data.mode === "update"
        ? `Produkt #${data.productId} aktualizován. Zakázka je v archivu.`
        : `Produkt #${data.productId} založen. Zakázka je v archivu.`;

  return {
    incomplete,
    text: incomplete
      ? `${base} Pozor: soubory do IML nejsou kompletní. ${summary}`
      : `${base} ${summary}`,
  };
}

export function GrafikaAutomationPanel({
  maketaId,
  canOperate,
  status,
  hasCustomer,
  hasProduct,
  imlApplied,
  filesIncomplete: filesIncompleteProp = false,
  printDataOnProduct = false,
  softproofOnProduct = false,
  hadPrintDataOnMaketa = false,
  hadSoftproofOnMaketa = false,
}: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [incomplete, setIncomplete] = useState(filesIncompleteProp);

  const [draft, setDraft] = useState<MaketyProductDraft | null>(null);
  const [draftOpen, setDraftOpen] = useState(false);
  const [draftMeta, setDraftMeta] = useState<{
    customerName: string | null;
    dieCutLabel: string | null;
  } | null>(null);
  const [conflict, setConflict] = useState<MaketyImlProductConflict | null>(null);
  const autoOpened = useRef(false);

  useEffect(() => {
    setIncomplete(filesIncompleteProp);
  }, [filesIncompleteProp]);

  const normalizeIgCode = (code: string | null | undefined) =>
    code?.trim().toUpperCase() ?? "";

  const activeConflict = useMemo(() => {
    if (!conflict || !draft?.ig_code?.trim()) return null;
    if (normalizeIgCode(conflict.ig_code) !== normalizeIgCode(draft.ig_code)) return null;
    return conflict;
  }, [conflict, draft?.ig_code]);

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
      setConflict((data.conflict as MaketyImlProductConflict | null) ?? null);
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

  const onRetransfer = async () => {
    setBusy("retransfer");
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(`/api/makety/${maketaId}/retransfer-product-files`, {
        method: "POST",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Přenos selhal");
        setBusy(null);
        return;
      }
      const formatted = formatTransferMessage(data, "retransfer");
      setIncomplete(formatted.incomplete);
      if (formatted.incomplete) {
        setError(formatted.text);
        setMessage(null);
      } else {
        setMessage(formatted.text);
        setError(null);
      }
      router.refresh();
    } catch {
      setError("Síťová chyba");
    }
    setBusy(null);
  };

  if (!canOperate || status !== "approved") return null;

  const onApplyDraft = async () => {
    if (!draft) return;
    setBusy("apply");
    setError(null);
    try {
      const payload = activeConflict
        ? {
            ...draft,
            confirmReplace: true,
            mode: "update" as const,
            product_id: activeConflict.product_id,
          }
        : draft;

      const res = await fetch(`/api/makety/${maketaId}/apply-product-draft`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const errMsg = typeof data.error === "string" ? data.error : "Uložení selhalo";
        setError(
          res.status === 409
            ? `${errMsg} Zavřete dialog a znovu připravte návrh, pokud jste změnili Kód IG.`
            : errMsg
        );
        if (data.draft) setDraft(data.draft as MaketyProductDraft);
        if (data.conflict) setConflict(data.conflict as MaketyImlProductConflict);
        setBusy(null);
        return;
      }
      setDraftOpen(false);
      setDraft(null);
      setConflict(null);
      const formatted = formatTransferMessage(data, "apply");
      setIncomplete(formatted.incomplete);
      if (formatted.incomplete) {
        setError(formatted.text);
        setMessage(null);
      } else {
        setMessage(formatted.text);
        setError(null);
      }
      router.refresh();
    } catch {
      setError("Síťová chyba");
    }
    setBusy(null);
  };

  if (imlApplied) {
    const showMissingPrint =
      incomplete || (hadPrintDataOnMaketa && !printDataOnProduct);
    const showMissingSoftproof =
      hadSoftproofOnMaketa && !softproofOnProduct && !hadPrintDataOnMaketa;

    return (
      <div
        className={
          showMissingPrint || showMissingSoftproof
            ? "rounded-xl border border-amber-400 bg-amber-50 p-5 shadow-sm dark:border-amber-700 dark:bg-amber-950/40"
            : "rounded-xl border border-emerald-200 bg-emerald-50 p-5 shadow-sm dark:border-emerald-800 dark:bg-emerald-950/40"
        }
      >
        <h3
          className={
            showMissingPrint || showMissingSoftproof
              ? "text-sm font-semibold text-amber-950 dark:text-amber-100"
              : "text-sm font-semibold text-emerald-900 dark:text-emerald-100"
          }
        >
          {showMissingPrint || showMissingSoftproof
            ? "Produkt v IML — soubory neúplné"
            : "Produkt v IML"}
        </h3>
        <p
          className={
            showMissingPrint || showMissingSoftproof
              ? "mt-1 text-xs text-amber-900 dark:text-amber-200"
              : "mt-1 text-xs text-emerald-800 dark:text-emerald-200"
          }
        >
          {showMissingPrint
            ? "Záznam v IML je založený, ale ostrá tisková data se nepropsala. Zkontrolujte typ souboru (PDF) u zakázky a zkuste znovu přenést."
            : showMissingSoftproof
              ? "Záznam v IML je založený, ale softproof / náhled chybí."
              : "Záznam v IML je potvrzený, zakázka je v archivu."}
        </p>
        <ul className="mt-3 space-y-1 text-xs text-gray-700 dark:text-gray-300">
          <li>
            Softproof / náhled:{" "}
            {softproofOnProduct ? "ano" : hadSoftproofOnMaketa ? "chybí v IML" : "u zakázky nebyl"}
          </li>
          <li>
            Ostrá tisková data:{" "}
            {printDataOnProduct
              ? "ano"
              : hadPrintDataOnMaketa
                ? "chybí v IML"
                : "u zakázky nebyla"}
          </li>
        </ul>
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
        <button
          type="button"
          onClick={() => void onRetransfer()}
          disabled={busy != null}
          className="mt-4 rounded-lg border border-amber-500 bg-white px-4 py-2 text-sm font-medium text-amber-950 hover:bg-amber-100 disabled:opacity-50 dark:border-amber-600 dark:bg-amber-900/40 dark:text-amber-50"
        >
          {busy === "retransfer" ? "Přenáším…" : "Znovu přenést soubory do IML"}
        </button>
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
              {activeConflict
                ? "Nahradit soubory u existujícího produktu?"
                : draft.mode === "update"
                  ? "Aktualizovat záznam v IML"
                  : "Založit záznam v IML"}
            </h4>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              {activeConflict
                ? "Nový záznam v IML nevznikne. Po potvrzení se nahradí softproof a tisková data; prázdná metadata se doplní z grafiky."
                : "Přijmout zapíše produkt do katalogu a přesune zakázku do archivu. Odmítnout zápis přeskočí — zakázka zůstane aktivní a dialog lze zopakovat."}
            </p>

            {activeConflict && (
              <div className="mt-4 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-950 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100">
                Produkt s kódem{" "}
                <strong>{activeConflict.ig_code ?? draft.ig_code}</strong> již existuje
                (#{activeConflict.product_id}
                {activeConflict.client_name || activeConflict.ig_short_name
                  ? `, ${activeConflict.client_name ?? activeConflict.ig_short_name}`
                  : ""}
                ). Nový záznam nevznikne.
              </div>
            )}

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
                {busy === "apply"
                  ? "Ukládám…"
                  : activeConflict
                    ? "Nahradit softproof a tisková data"
                    : "Přijmout"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
